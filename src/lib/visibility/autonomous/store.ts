import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { METHODOLOGY_VERSION } from "@/lib/visibility/methodology";
import { rankEligible, technicalTip, validateAssessment, validateReview, type Assessment, type Review } from "./assessment";
import { COHORT, LIMITS, POLICY_VERSION, rootUrl, siteId, type Candidate } from "./policy";

export type Entry = Candidate & {
  status: "PENDING" | "REVIEWING" | "ASSESSED" | "WITHHELD" | "SKIPPED";
  scanAttempts: number;
  reviewAttempts: Partial<Record<"codex" | "claude", number>>;
  reviews: Partial<Record<"codex" | "claude", Review>>;
  assessment?: Assessment;
  reason?: string;
};
export type Database = {
  schemaVersion: 1;
  policyVersion: string;
  methodologyVersion: string;
  cohort: string;
  batchId: string;
  createdAt: string;
  updatedAt: string;
  targetCount: number;
  discoveryRounds: number;
  agentCalls: number;
  state: "READY" | "RUNNING" | "COMPLETE" | "PAUSED" | "EXHAUSTED" | "LIMIT_REACHED" | "AUTH_REQUIRED";
  retryAfter: string | null;
  entries: Entry[];
};

export function freshDatabase(targetCount: number = LIMITS.targetCount): Database {
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > LIMITS.targetCount) throw new Error("TARGET_COUNT_OUT_OF_BOUNDS");
  const now = new Date().toISOString();
  return { schemaVersion: 1, policyVersion: POLICY_VERSION, methodologyVersion: METHODOLOGY_VERSION,
    cohort: COHORT, batchId: randomUUID(), createdAt: now, updatedAt: now, targetCount,
    discoveryRounds: 0, agentCalls: 0, state: "READY", retryAfter: null, entries: [] };
}

export async function atomicJson(filename: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temp = `${filename}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    // Windows scanners/indexers can briefly hold an existing JSON file open.
    // Keep the old checkpoint intact; never unlink it to make replacement work.
    for (let attempt = 0; ; attempt += 1) {
      try { await fs.rename(temp, filename); break; }
      catch (error) {
        if (attempt >= 6 || !["EPERM", "EACCES", "EBUSY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
        await delay(25 * 2 ** attempt);
      }
    }
  } finally { await fs.rm(temp, { force: true }); }
}

export function defaultRoot(): string {
  return path.resolve("reports/visibility/autonomous");
}

export async function loadDatabase(root: string, count?: number): Promise<Database> {
  let value: Database;
  try {
    const file = path.join(root, "database.json");
    if ((await fs.stat(file)).size > 20 * 1024 * 1024) throw new Error("DATABASE_TOO_LARGE");
    value = JSON.parse(await fs.readFile(file, "utf8")) as Database;
  }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return freshDatabase(count); throw new Error("INVALID_DATABASE"); }
  if (value.schemaVersion !== 1 || value.policyVersion !== POLICY_VERSION || value.methodologyVersion !== METHODOLOGY_VERSION ||
    value.cohort !== COHORT || !Array.isArray(value.entries) || value.entries.length > LIMITS.maxCandidates ||
    !Number.isInteger(value.agentCalls) || value.agentCalls < 0 || value.agentCalls > LIMITS.maxAgentCalls ||
    !Number.isInteger(value.discoveryRounds) || value.discoveryRounds < 0 || value.discoveryRounds > LIMITS.maxDiscoveryRounds ||
    !Number.isInteger(value.targetCount) || value.targetCount < 1 || value.targetCount > LIMITS.targetCount) throw new Error("INCOMPATIBLE_DATABASE");
  if (count !== undefined && value.targetCount !== count) throw new Error("EXISTING_BATCH_TARGET_DIFFERS");
  if (!/^[a-f0-9-]{36}$/.test(value.batchId) || !validDate(value.createdAt) || !validDate(value.updatedAt) ||
    (value.retryAfter !== null && !validDate(value.retryAfter)) ||
    !["READY", "RUNNING", "COMPLETE", "PAUSED", "EXHAUSTED", "LIMIT_REACHED", "AUTH_REQUIRED"].includes(value.state)) throw new Error("INVALID_DATABASE");
  const ids = new Set<string>();
  value.entries = value.entries.map(e => {
    if (!e || e.homeUrl !== rootUrl(e.homeUrl, true) || e.id !== siteId(e.homeUrl) || ids.has(e.id) ||
      e.sourceOrigin !== rootUrl(e.sourceOrigin)?.slice(0, -1) ||
      e.approvalBasis !== "PUBLIC_SCOPE" || e.policyVersion !== POLICY_VERSION ||
      !["codex", "claude"].includes(e.discoveredBy) || !["PENDING", "REVIEWING", "ASSESSED", "WITHHELD", "SKIPPED"].includes(e.status) ||
      !Number.isInteger(e.scanAttempts) || e.scanAttempts < 0 || e.scanAttempts > LIMITS.maxScanAttempts) throw new Error("INVALID_ENTRY");
    ids.add(e.id);
    const entry: Entry = { id: e.id, homeUrl: e.homeUrl, sourceOrigin: e.sourceOrigin, discoveredBy: e.discoveredBy,
      approvalBasis: "PUBLIC_SCOPE", policyVersion: POLICY_VERSION, status: e.status,
      scanAttempts: e.scanAttempts, reviews: {}, reviewAttempts: {} };
    if (e.reason && REASONS.has(e.reason)) entry.reason = e.reason;
    if (e.assessment) {
      const assessment = validateAssessment(e.assessment);
      if (!assessment) throw new Error("INVALID_ASSESSMENT");
      entry.assessment = assessment;
    }
    if (["REVIEWING", "ASSESSED", "WITHHELD"].includes(e.status) && !entry.assessment) throw new Error("MISSING_ASSESSMENT");
    for (const provider of ["codex", "claude"] as const) {
      const attempts = e.reviewAttempts?.[provider] ?? 0;
      if (!Number.isInteger(attempts) || attempts < 0 || attempts > LIMITS.maxReviewAttempts) throw new Error("INVALID_ATTEMPTS");
      entry.reviewAttempts[provider] = attempts;
      if (e.reviews?.[provider]) {
        const review = entry.assessment && validateReview(e.reviews[provider], entry.assessment);
        if (!review) throw new Error("INVALID_REVIEW");
        entry.reviews[provider] = review;
      }
    }
    return entry;
  });
  // Reconstruct the outer object as well; no unknown disk fields are re-exported.
  return { schemaVersion: 1, policyVersion: POLICY_VERSION, methodologyVersion: METHODOLOGY_VERSION, cohort: COHORT,
    batchId: value.batchId, createdAt: value.createdAt, updatedAt: value.updatedAt, targetCount: value.targetCount,
    discoveryRounds: value.discoveryRounds, agentCalls: value.agentCalls, state: value.state,
    retryAfter: value.retryAfter, entries: value.entries };
}

const REASONS = new Set(["SCAN_ATTEMPTS_EXHAUSTED", "ROBOTS_BLOCKED", "ACCESS_RESTRICTED", "UNREACHABLE",
  "COMPANY_SCOPE_NOT_CONFIRMED", "SCAN_ERROR", "REVIEW_UNAVAILABLE", "INVALID_REVIEW", "REVIEW_WITHHELD",
  "TIMEOUT", "INVALID_OUTPUT", "FAILED", "AUTH", "RATE_LIMIT", "UNAVAILABLE", "OUT_OF_SCOPE_REDIRECT"]);

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function ranking(db: Database) {
  const eligible = db.entries.filter(e => e.assessment && rankEligible(e.assessment, e.reviews))
    .sort((x, y) => y.assessment!.scores.overall! - x.assessment!.scores.overall! || x.id.localeCompare(y.id));
  let previous: number | null = null;
  let rank = 0;
  const rows = eligible.map((e, index) => {
    const a = e.assessment!;
    if (a.scores.overall !== previous) rank = index + 1;
    previous = a.scores.overall;
    return { rank, website: e.homeUrl, scannedAt: a.scannedAt, overall: a.scores.overall, seo: a.scores.seo,
      aeo: a.scores.aeo, coverage: a.scores.coverage,
      strongInBothPillars: a.scores.seo! >= 85 && a.scores.aeo! >= 85,
      strength: technicalTip(e.reviews.codex!.strengthMetricId, "strength"),
      improvement: technicalTip(e.reviews.claude!.improvementMetricId, "improvement") };
  });
  return { publicationStatus: "REQUIRES_APPROVAL", methodologyVersion: db.methodologyVersion,
    policyVersion: db.policyVersion, cohort: db.cohort, batchId: db.batchId, generatedAt: db.updatedAt,
    limitations: ["Draft technical diagnostic, not actual search positions or AI citations.",
      "A small raw-HTML sample; .ie company selection is not representative of Irish businesses.",
      "Two agents review numerical consistency and tip selection; they do not independently verify the observations.",
      "Heuristic metrics are not proven ranking factors; no legal compliance or business-quality assessment."], rows };
}

export async function saveDatabase(root: string, db: Database): Promise<void> {
  db.updatedAt = new Date().toISOString();
  await atomicJson(path.join(root, "database.json"), db);
  await atomicJson(path.join(root, "ranked-draft.json"), ranking(db));
}

export async function acquireLock(root: string): Promise<() => Promise<void>> {
  await fs.mkdir(root, { recursive: true });
  const filename = path.join(root, "batch.lock");
  const token = randomUUID();
  try { await fs.writeFile(filename, JSON.stringify({ pid: process.pid, token }), { flag: "wx", mode: 0o600 }); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    throw new Error("BATCH_LOCKED: another runner or a stale batch.lock exists; use --unlock-stale after stopping it");
  }
  return async () => {
    const own = JSON.parse(await fs.readFile(filename, "utf8"));
    if (own.token === token) await fs.unlink(filename);
  };
}

export async function unlockStale(root: string): Promise<void> {
  const filename = path.join(root, "batch.lock");
  let lock: { pid: number };
  try { lock = JSON.parse(await fs.readFile(filename, "utf8")); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return; throw new Error("INVALID_LOCK"); }
  if (!Number.isInteger(lock.pid) || lock.pid <= 0) throw new Error("INVALID_LOCK");
  try { process.kill(lock.pid, 0); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ESRCH") { await fs.unlink(filename); return; }
    throw new Error("LOCK_OWNER_CANNOT_BE_CHECKED");
  }
  throw new Error("RUNNER_STILL_ACTIVE");
}
