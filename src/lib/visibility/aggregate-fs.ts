import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ID_PATTERN,
  buildConsensus,
  toCsv,
  validateSubmission,
  type ConsensusReport,
  type Submission,
} from "@/lib/visibility/aggregate";
import { METHODOLOGY, METHODOLOGY_VERSION } from "@/lib/visibility/methodology";

export const DEFAULT_ROOT = process.env.VISIBILITY_ROOT || "reports/visibility";
const MAX_FILE_BYTES = 256 * 1024;

export function assertId(value: string, label: string): string {
  if (!ID_PATTERN.test(value)) {
    throw new RangeError(`${label} "${value}" is not a safe identifier.`);
  }
  return value;
}

function inside(root: string, ...parts: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...parts);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new RangeError("Path escapes the visibility reports folder.");
  }
  return resolved;
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temp, file);
}

async function readJsonLimited(file: string): Promise<unknown> {
  const stat = await fs.stat(file);
  if (stat.size > MAX_FILE_BYTES) throw new RangeError(`${path.basename(file)} is larger than ${MAX_FILE_BYTES} bytes.`);
  return JSON.parse(await fs.readFile(file, "utf8"));
}

const POLICY = {
  scanOnlyApproved: true,
  doubleRatingRequired: true,
  maxRequestsPerTarget: 60,
  minDaysBetweenRuns: 7,
};

// The standalone pack starts with no approved targets; the owner adds each one.
const DEFAULT_TARGETS =
  process.env.VISIBILITY_PACK === "1"
    ? { policy: POLICY, targets: [] }
    : {
        policy: POLICY,
        targets: [
          {
            targetId: "databridges-ie",
            homeUrl: "https://databridges.ie/",
            status: "APPROVED",
            approvalBasis: "OWNED",
            approvalRef: "Owner instruction, 2026-10-02: DataBridges-owned site",
            approvedBy: "Oisin Bridges",
            approvedAt: "2026-10-02",
            sector: "consultancy",
            notes: "",
          },
        ],
      };

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function initRoot(root: string = DEFAULT_ROOT): Promise<string[]> {
  const created: string[] = [];
  for (const dir of ["runs", "scores", "history"]) {
    await fs.mkdir(inside(root, dir), { recursive: true });
  }
  const targets = inside(root, "targets.json");
  if (!(await exists(targets))) {
    await writeJsonAtomic(targets, DEFAULT_TARGETS);
    created.push("targets.json");
  }
  const candidates = inside(root, "candidates.json");
  if (!(await exists(candidates))) {
    await writeJsonAtomic(candidates, { candidates: [] });
    created.push("candidates.json");
  }
  return created;
}

export type ApprovedTarget = {
  targetId: string;
  homeUrl: string;
  status: string;
  approvalBasis: string;
  approvalRef: string;
};

export async function getApprovedTarget(root: string, targetId: string): Promise<ApprovedTarget> {
  assertId(targetId, "targetId");
  let parsed: unknown;
  try {
    parsed = await readJsonLimited(inside(root, "targets.json"));
  } catch {
    throw new RangeError("targets.json is missing or unreadable; run --init and ask the owner to approve targets.");
  }
  const list = (parsed as { targets?: unknown }).targets;
  const found = Array.isArray(list)
    ? (list as Record<string, unknown>[]).find((t) => t && t.targetId === targetId)
    : undefined;
  if (!found) throw new RangeError(`Target "${targetId}" is not in targets.json; only the owner can add targets.`);
  if (found.status !== "APPROVED") {
    throw new RangeError(`Target "${targetId}" has status ${String(found.status)}, not APPROVED, so it must not be scored.`);
  }
  if (found.approvalBasis !== "OWNED" && found.approvalBasis !== "WRITTEN_CONSENT") {
    throw new RangeError(`Target "${targetId}" has no valid approvalBasis (OWNED or WRITTEN_CONSENT).`);
  }
  if (typeof found.homeUrl !== "string" || typeof found.approvalRef !== "string" || found.approvalRef.trim() === "") {
    throw new RangeError(`Target "${targetId}" needs a homeUrl and an approvalRef.`);
  }
  return found as unknown as ApprovedTarget;
}

export async function writeSkeleton(
  root: string,
  targetId: string,
  runId: string,
  agentId: string
): Promise<string> {
  assertId(runId, "runId");
  assertId(agentId, "agentId");
  const target = await getApprovedTarget(root, targetId);
  const file = inside(root, "runs", targetId, runId, `${agentId}.json`);
  if (await exists(file)) throw new RangeError(`${path.basename(file)} already exists; edit it instead.`);
  const perPage = new Set(["P", "CP", "KO", "AP"]);
  const skeleton = {
    schemaVersion: 1,
    methodologyVersion: METHODOLOGY_VERSION,
    targetId,
    homeUrl: target.homeUrl,
    runId,
    agentId,
    scannedAt: "REPLACE-with-ISO-8601-time-of-the-scan",
    mode: "manual-agent",
    outcome: "COMPLETED",
    sampledPages: [{ url: target.homeUrl, type: "home", reason: "Homepage" }],
    criticalFindings: [],
    notes: "",
    metrics: METHODOLOGY.metrics.map((m) =>
      perPage.has(m.scope)
        ? { metricId: m.id, pageScores: [], evidence: [], explanation: "TODO" }
        : { metricId: m.id, outcome: "NOT_OBSERVED", evidence: [], explanation: "TODO" }
    ),
  };
  await writeJsonAtomic(file, skeleton);
  return file;
}

export type LoadedSubmissions = {
  valid: Submission[];
  invalid: { file: string; errors: string[] }[];
};

export async function loadSubmissions(root: string, targetId: string, runId: string): Promise<LoadedSubmissions> {
  assertId(targetId, "targetId");
  assertId(runId, "runId");
  const dir = inside(root, "runs", targetId, runId);
  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return { valid: [], invalid: [] };
  }
  const valid: Submission[] = [];
  const invalid: LoadedSubmissions["invalid"] = [];
  for (const name of names) {
    try {
      const parsed = await readJsonLimited(path.join(dir, name));
      const result = validateSubmission(parsed);
      if (!result.ok) {
        invalid.push({ file: name, errors: result.errors });
        continue;
      }
      const sub = result.submission;
      const problems: string[] = [];
      if (sub.targetId !== targetId) problems.push(`targetId is "${sub.targetId}" but the folder is "${targetId}".`);
      if (sub.runId !== runId) problems.push(`runId is "${sub.runId}" but the folder is "${runId}".`);
      if (`${sub.agentId}.json` !== name) problems.push(`The file must be named ${sub.agentId}.json.`);
      if (problems.length > 0) invalid.push({ file: name, errors: problems });
      else valid.push(sub);
    } catch (error) {
      invalid.push({ file: name, errors: [`Could not read or parse: ${error instanceof Error ? error.message : String(error)}`] });
    }
  }
  return { valid, invalid };
}

export async function rebuildIndex(root: string = DEFAULT_ROOT): Promise<number> {
  const dir = inside(root, "scores");
  let names: string[] = [];
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    names = [];
  }
  const reports: ConsensusReport[] = [];
  for (const name of names) {
    try {
      reports.push((await readJsonLimited(path.join(dir, name))) as ConsensusReport);
    } catch {
      continue;
    }
  }
  await fs.mkdir(inside(root), { recursive: true });
  const file = inside(root, "index.csv");
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, toCsv(reports), "utf8");
  await fs.rename(temp, file);
  return reports.length;
}

export type AggregateOutcome = {
  report: ConsensusReport | null;
  invalid: LoadedSubmissions["invalid"];
};

export async function aggregateTarget(root: string, targetId: string, runId: string): Promise<AggregateOutcome> {
  await getApprovedTarget(root, targetId);
  const { valid, invalid } = await loadSubmissions(root, targetId, runId);
  if (valid.length === 0) return { report: null, invalid };
  const report = buildConsensus(valid);
  await writeJsonAtomic(inside(root, "scores", `${targetId}.json`), report);
  await writeJsonAtomic(inside(root, "history", targetId, `${runId}.json`), report);
  await rebuildIndex(root);
  return { report, invalid };
}

export async function listRunTargets(root: string, runId: string): Promise<string[]> {
  assertId(runId, "runId");
  let targets: string[] = [];
  try {
    targets = await fs.readdir(inside(root, "runs"));
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const id of targets.sort()) {
    if (!ID_PATTERN.test(id)) continue;
    if (await exists(inside(root, "runs", id, runId))) found.push(id);
  }
  return found;
}
