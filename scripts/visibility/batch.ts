import { promises as fs } from "node:fs";
import path from "node:path";
import { scanSite } from "@/lib/visibility/scan";
import type { ScanSnapshot } from "@/lib/visibility/types";
import { assess, reviewPayload, validateReview } from "@/lib/visibility/autonomous/assessment";
import { AgentFailure, invokeAgent, type ProviderName } from "./agents";
import { admitCandidates, allowedHosts, DISCOVERY_QUERIES, LIMITS } from "@/lib/visibility/autonomous/policy";
import { saveDatabase, type Database, type Entry } from "@/lib/visibility/autonomous/store";

type Invoke = (provider: ProviderName, role: "discover" | "review", payload: unknown) => Promise<unknown>;
export type BatchDependencies = {
  invoke?: Invoke;
  scan?: (url: string) => Promise<ScanSnapshot>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  stopped?: () => Promise<boolean>;
};

export function counts(db: Database) {
  return { candidates: db.entries.length,
    assessed: db.entries.filter(e => (e.status === "ASSESSED" || e.status === "WITHHELD") && e.reviews.codex && e.reviews.claude).length,
    withheld: db.entries.filter(e => e.status === "WITHHELD").length,
    skipped: db.entries.filter(e => e.status === "SKIPPED").length,
    awaiting: db.entries.filter(e => e.status === "PENDING" || e.status === "REVIEWING").length };
}

function failureCode(error: unknown): string {
  return error instanceof AgentFailure ? error.code : "FAILED";
}

export async function runBatch(db: Database, root: string, deps: BatchDependencies = {}): Promise<Database> {
  const invoke = deps.invoke ?? invokeAgent;
  const scan = deps.scan ?? ((url: string) => scanSite(url, {
    now: new Date(), scannerVersion: "visibility-autonomous-1", allowedHosts: allowedHosts(url), includeExtraHosts: false,
  }));
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const stopped = deps.stopped ?? (async () => {
    try { await fs.access(path.join(root, "STOP")); return true; } catch { return false; }
  });
  const deadline = now() + LIMITS.maxHours * 3_600_000;
  // Counts are persisted across restarts; starting another process never resets call/candidate budgets.
  const save = () => saveDatabase(root, db);
  const pause = async () => { db.state = "PAUSED"; await save(); return db; };
  const call = async (provider: ProviderName, role: "discover" | "review", payload: unknown) => {
    if (db.agentCalls >= LIMITS.maxAgentCalls) throw new AgentFailure("FAILED");
    db.agentCalls += 1;
    await save(); // reserve the call before dispatch; a crash cannot create unlimited retries
    return invoke(provider, role, payload);
  };
  const cooldown = async (code: string): Promise<boolean> => {
    if (code === "AUTH" || code === "UNAVAILABLE") { db.state = "AUTH_REQUIRED"; await save(); return false; }
    if (code !== "RATE_LIMIT") return true;
    db.retryAfter = new Date(now() + LIMITS.rateLimitBackoffMs).toISOString();
    await save();
    return true;
  };

  db.state = "RUNNING";
  await save();
  while (true) {
    if (await stopped()) return pause();
    if (counts(db).assessed >= db.targetCount) { db.state = "COMPLETE"; await save(); return db; }
    if (now() >= deadline || db.agentCalls >= LIMITS.maxAgentCalls) { db.state = "LIMIT_REACHED"; await save(); return db; }
    if (db.retryAfter) {
      const remaining = new Date(db.retryAfter).getTime() - now();
      if (remaining > 0) { await sleep(Math.min(remaining, 5_000)); continue; }
      db.retryAfter = null;
    }

    const entry = db.entries.find(e => e.status === "REVIEWING" || e.status === "PENDING");
    if (!entry) {
      if (db.discoveryRounds >= LIMITS.maxDiscoveryRounds || db.entries.length >= LIMITS.maxCandidates) {
        db.state = "EXHAUSTED"; await save(); return db;
      }
      const round = db.discoveryRounds;
      const provider: ProviderName = round % 2 ? "claude" : "codex";
      db.discoveryRounds += 1;
      await save();
      try {
        const found = admitCandidates(await call(provider, "discover", {
          query: DISCOVERY_QUERIES[Math.floor(round / 2) % DISCOVERY_QUERIES.length],
          excludedHosts: db.entries.map(e => new URL(e.homeUrl).hostname),
          maxCandidates: Math.min(10, LIMITS.maxCandidates - db.entries.length),
        }), provider);
        for (const candidate of found) {
          if (db.entries.length >= LIMITS.maxCandidates) break;
          if (db.entries.some(e => e.id === candidate.id)) continue;
          db.entries.push({ ...candidate, status: "PENDING", scanAttempts: 0, reviewAttempts: {}, reviews: {} });
        }
      } catch (error) {
        const code = failureCode(error);
        if (code === "RATE_LIMIT") db.discoveryRounds -= 1;
        if (!await cooldown(code)) return db;
      }
      await save();
      continue;
    }

    if (entry.status === "PENDING") {
      if (entry.scanAttempts >= LIMITS.maxScanAttempts) { skip(entry, "SCAN_ATTEMPTS_EXHAUSTED"); await save(); continue; }
      entry.scanAttempts += 1;
      await save();
      try {
        const snapshot = await scan(entry.homeUrl);
        if (!allowedHosts(entry.homeUrl).includes(new URL(snapshot.homeUrl).hostname)) {
          skip(entry, "OUT_OF_SCOPE_REDIRECT"); await save(); continue;
        }
        const assessment = assess(snapshot);
        if (assessment.outcome === "BLOCKED_BY_ROBOTS") skip(entry, "ROBOTS_BLOCKED");
        else if (assessment.criticalFindingIds.includes("CF-07")) skip(entry, "ACCESS_RESTRICTED");
        else if (assessment.outcome !== "COMPLETED") {
          if (entry.scanAttempts >= LIMITS.maxScanAttempts) skip(entry, "UNREACHABLE");
        } else if (!assessment.companyMarkerObserved) skip(entry, "COMPANY_SCOPE_NOT_CONFIRMED");
        else { entry.assessment = assessment; entry.status = "REVIEWING"; }
      } catch {
        if (entry.scanAttempts >= LIMITS.maxScanAttempts) skip(entry, "SCAN_ERROR");
      }
      await save();
      continue;
    }

    for (const provider of ["codex", "claude"] as const) {
      if (await stopped()) return pause();
      if (now() >= deadline || db.agentCalls >= LIMITS.maxAgentCalls) { db.state = "LIMIT_REACHED"; await save(); return db; }
      if (entry.reviews[provider]) continue;
      if ((entry.reviewAttempts[provider] ?? 0) >= LIMITS.maxReviewAttempts) {
        entry.status = "WITHHELD"; entry.reason = "REVIEW_UNAVAILABLE"; break;
      }
      entry.reviewAttempts[provider] = (entry.reviewAttempts[provider] ?? 0) + 1;
      await save();
      try {
        const review = validateReview(await call(provider, "review", reviewPayload(entry.assessment!)), entry.assessment!);
        if (review) entry.reviews[provider] = review;
        else entry.reason = "INVALID_REVIEW";
      } catch (error) {
        const code = failureCode(error);
        if (["RATE_LIMIT", "AUTH", "UNAVAILABLE"].includes(code)) {
          entry.reviewAttempts[provider] -= 1;
          if (!await cooldown(code)) return db;
          break;
        }
        entry.reason = code;
      }
    }
    if (entry.reviews.codex && entry.reviews.claude) {
      entry.status = entry.reviews.codex.verdict === "CONFIRMED" && entry.reviews.claude.verdict === "CONFIRMED" ? "ASSESSED" : "WITHHELD";
      if (entry.status === "WITHHELD") entry.reason = "REVIEW_WITHHELD";
    }
    await save();
  }
}

function skip(entry: Entry, reason: string): void {
  entry.status = "SKIPPED"; entry.reason = reason;
  // Never leave failed/raw observations in persisted records.
  delete entry.assessment;
}
