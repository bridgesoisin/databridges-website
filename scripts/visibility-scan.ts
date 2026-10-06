import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluateSnapshot, scoreBands } from "@/lib/visibility/evaluate";
import { DEFAULT_ALLOWED_HOSTS } from "@/lib/visibility/fetch";
import type { Resolver } from "@/lib/visibility/net-guard";
import { renderJson, renderMarkdown } from "@/lib/visibility/report";
import { scanSite } from "@/lib/visibility/scan";
import { displayScore, roundHalfUp } from "@/lib/visibility/scoring";
import type { FetchRecord, ScanOutcome, ScanReport, ScanSnapshot, WithheldReason } from "@/lib/visibility/types";
import { parseTarget } from "@/lib/visibility/url";

export const SCANNER_VERSION = "visibility-cli-1";
export const DEFAULT_OUT_DIR = "reports";

export const EXIT_OK = 0;
export const EXIT_NO_SCORE = 1;
export const EXIT_USAGE = 2;
export const EXIT_REFUSED = 3;

const HELP = `Visibility Index scan (private engineering tool; nothing is published)

Usage: tsx scripts/visibility-scan.ts <url> [--out <dir>] [--json] [--md]

Scans one site with the guarded scanner, prints a short summary and writes the
report to disk.

Options
  --out <dir>   Directory for the reports (default: ${DEFAULT_OUT_DIR}, which is git-ignored)
  --json        Write the JSON report
  --md          Write the Markdown report
                With neither flag both reports are written.
  -h, --help    Show this help

Only ${DEFAULT_ALLOWED_HOSTS.join(" and ")} can be scanned. Any other host is
refused before a request is made, and no option changes that.

Exit codes
  0  the scan completed and the report was written
  1  no score: homepage unreachable, blocked by robots.txt, or the scan stopped on an error
  2  invalid arguments
  3  target refused (rejected URL or host not on the allowlist); nothing was requested
`;

const WITHHELD_TEXT: Readonly<Record<WithheldReason, string>> = {
  NO_SCORE_OUTCOME: "no score for this outcome",
  PILLAR_WEIGHT_BELOW_MINIMUM: "too little of this pillar could be observed",
  OVERALL_WEIGHT_BELOW_MINIMUM: "too little of the site could be observed",
  PILLAR_NOT_PUBLISHED: "a pillar score is not published",
};

const OUTCOME_TEXT: Readonly<Record<ScanOutcome, string>> = {
  COMPLETED: "Completed",
  BLOCKED_BY_ROBOTS: "Blocked by robots.txt (nothing else was requested)",
  UNREACHABLE: "Homepage unreachable over https and http",
  JOB_ERROR: "The scan stopped on an error",
};

export type CliOptions = {
  url: string;
  outDir: string;
  json: boolean;
  md: boolean;
  help: boolean;
};

export type ParseResult = { ok: true; options: CliOptions } | { ok: false; error: string };

function usageError(error: string): ParseResult {
  return { ok: false, error };
}

function unknownOption(name: string): ParseResult {
  const hint = /allow|host|domain|extra|insecure|ignore|robots|unsafe|force|timeout|limit/i.test(name)
    ? " The scan allowlist and the safety checks cannot be changed from the command line."
    : "";
  return usageError(`Unknown option ${name}.${hint}`);
}

export function parseArgs(argv: readonly string[]): ParseResult {
  let url: string | null = null;
  let outDir: string | null = null;
  let json = false;
  let md = false;
  let help = false;
  let optionsEnded = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!optionsEnded && arg === "--") {
      optionsEnded = true;
      continue;
    }
    if (optionsEnded || !arg.startsWith("-")) {
      if (url !== null) return usageError("Expected exactly one URL, but more than one was given.");
      url = arg;
      continue;
    }

    const equals = arg.indexOf("=");
    const name = equals === -1 ? arg : arg.slice(0, equals);
    const inline = equals === -1 ? null : arg.slice(equals + 1);
    switch (name) {
      case "-h":
      case "--help":
      case "--json":
      case "--md": {
        if (inline !== null) return usageError(`${name} does not take a value.`);
        if (name === "--json") json = true;
        else if (name === "--md") md = true;
        else help = true;
        break;
      }
      case "--out": {
        if (outDir !== null) return usageError("--out was given more than once.");
        const value = inline ?? argv[i + 1];
        if (value === undefined || value === "" || (inline === null && value.startsWith("-"))) {
          return usageError("--out needs a directory name.");
        }
        if (inline === null) i += 1;
        outDir = value;
        break;
      }
      default:
        return unknownOption(name);
    }
  }

  if (help) {
    return { ok: true, options: { url: url ?? "", outDir: outDir ?? DEFAULT_OUT_DIR, json, md, help: true } };
  }
  if (url === null) return usageError("A URL is required.");
  const both = !json && !md;
  return { ok: true, options: { url, outDir: outDir ?? DEFAULT_OUT_DIR, json: json || both, md: md || both, help: false } };
}

export type CliIo = { out: (text: string) => void; err: (text: string) => void };

export type CliDeps = {
  now?: () => Date;
  // Test seams only: the command line cannot reach them, and neither can widen the allowlist.
  resolver?: Resolver;
  scan?: (url: string, now: Date) => Promise<ScanSnapshot>;
  cwd?: string;
};

function refusedByAllowlist(snapshot: ScanSnapshot): boolean {
  if (snapshot.outcome !== "UNREACHABLE") return false;
  const attempts = [snapshot.httpsAttempt, snapshot.httpVariant].filter((record): record is FetchRecord => record !== null);
  return attempts.length > 0 && attempts.every((record) => record.error?.code === "HOST_NOT_ALLOWLISTED");
}

function fileStem(report: ScanReport): string {
  let host = "unknown";
  try {
    host = new URL(report.homeUrl).hostname.replace(/[^a-z0-9.-]/gi, "-");
  } catch {
    host = "unknown";
  }
  const stamp = report.scannedAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `visibility-${host}-${stamp}-${report.snapshotHash.slice(0, 8)}`;
}

function formatUtc(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Date(time).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function scoreLine(label: string, score: number | null, band: string | null, reason: WithheldReason | null): string {
  const shown = displayScore(score);
  if (shown === null || band === null) {
    return `${label}: withheld${reason === null ? "" : ` (${WITHHELD_TEXT[reason]})`}`;
  }
  return `${label}: ${shown} out of 100 (${band})`;
}

function summarise(report: ScanReport, files: readonly string[]): string {
  const bands = scoreBands(report.scores);
  const { withheld } = report.scores;
  const lines = [
    `Methodology ${report.methodologyVersion}, scanner ${report.scannerVersion}`,
    `Site: ${report.homeUrl}`,
    `Scanned: ${formatUtc(report.scannedAt)}`,
    `Outcome: ${OUTCOME_TEXT[report.outcome]}`,
  ];
  if (report.outcome === "COMPLETED") {
    lines.push(
      scoreLine("Overall", report.scores.overall, bands.overall, withheld.overall),
      scoreLine("SEO", report.scores.seo, bands.seo, withheld.seo),
      scoreLine("AEO", report.scores.aeo, bands.aeo, withheld.aeo),
      `Coverage: ${roundHalfUp(report.coverage * 100, 1)}% of the metric weight could be observed; ${report.pagesSampled.length} ${report.pagesSampled.length === 1 ? "page" : "pages"} sampled`,
    );
    if (report.criticalFindings.length > 0) {
      lines.push("Critical findings:");
      for (const finding of report.criticalFindings) lines.push(`  ${finding.id}: ${finding.summary}`);
    }
  } else if (report.outcomeDetail !== null) {
    lines.push(`Detail: ${report.outcomeDetail}`);
  }
  if (/draft/i.test(report.methodologyVersion)) {
    lines.push("Draft methodology: results are engineering calibration results, not published claims.");
  }
  const [first, ...more] = report.limitations;
  if (first !== undefined) lines.push(`Limitations: ${first}${more.length > 0 ? ` (${more.length} more in the report)` : ""}`);
  lines.push(`Corrections: ${report.correctionRoute}`);
  for (const [index, file] of files.entries()) lines.push(`${index === 0 ? "Wrote" : "     "}: ${file}`);
  return `${lines.join("\n")}\n`;
}

function outsideReports(dir: string, cwd: string): boolean {
  const relative = path.relative(cwd, dir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  return relative.split(path.sep)[0] !== DEFAULT_OUT_DIR;
}

function shortPath(file: string, cwd: string): string {
  const relative = path.relative(cwd, file);
  return relative.startsWith("..") || path.isAbsolute(relative) ? file : relative;
}

export async function runCli(argv: readonly string[], io: CliIo, deps: CliDeps = {}): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    io.err(`${parsed.error}\n\nUsage: tsx scripts/visibility-scan.ts <url> [--out <dir>] [--json] [--md]\nRun with --help for details.\n`);
    return EXIT_USAGE;
  }
  const { options } = parsed;
  if (options.help) {
    io.out(HELP);
    return EXIT_OK;
  }

  const target = parseTarget(options.url);
  if (!target.ok) {
    io.err(`Refused: the target was rejected (${target.reason}). Nothing was requested.\n`);
    return EXIT_REFUSED;
  }

  const cwd = deps.cwd ?? process.cwd();
  const now = (deps.now ?? (() => new Date()))();
  let snapshot: ScanSnapshot;
  try {
    snapshot = deps.scan
      ? await deps.scan(options.url, now)
      : await scanSite(options.url, { now, scannerVersion: SCANNER_VERSION, resolver: deps.resolver });
  } catch (error) {
    io.err(`The scan stopped on an unexpected error: ${error instanceof Error ? error.message : "unknown error"}\n`);
    return EXIT_NO_SCORE;
  }

  if (refusedByAllowlist(snapshot)) {
    io.err(
      `Refused: ${target.host} is not on the scan allowlist (${DEFAULT_ALLOWED_HOSTS.join(", ")}). Nothing was requested.\n` +
        "Scanning any other host needs a separate approval (plan section 8).\n",
    );
    return EXIT_REFUSED;
  }

  let report: ScanReport;
  try {
    report = evaluateSnapshot(snapshot);
  } catch (error) {
    io.err(`The scan could not be evaluated: ${error instanceof Error ? error.message : "unknown error"}\n`);
    return EXIT_NO_SCORE;
  }
  const outDir = path.resolve(cwd, options.outDir);
  const stem = fileStem(report);
  const written: string[] = [];
  try {
    mkdirSync(outDir, { recursive: true });
    if (options.json) {
      const file = path.join(outDir, `${stem}.json`);
      writeFileSync(file, renderJson(report), "utf8");
      written.push(shortPath(file, cwd));
    }
    if (options.md) {
      const file = path.join(outDir, `${stem}.md`);
      writeFileSync(file, renderMarkdown(report), "utf8");
      written.push(shortPath(file, cwd));
    }
  } catch (error) {
    io.out(summarise(report, written));
    io.err(`Could not write the report: ${error instanceof Error ? error.message : "unknown error"}\n`);
    return EXIT_NO_SCORE;
  }

  io.out(summarise(report, written));
  if (outsideReports(outDir, cwd)) {
    io.err(`Note: ${options.outDir} is not under ${DEFAULT_OUT_DIR}/, the git-ignored location. Reports can hold third-party data; do not commit them.\n`);
  }
  return report.outcome === "COMPLETED" ? EXIT_OK : EXIT_NO_SCORE;
}

async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2), {
    out: (text) => void process.stdout.write(text),
    err: (text) => void process.stderr.write(text),
  });
  process.exitCode = code;
}

if (/[\\/]visibility-scan\.[cm]?[jt]s$/.test(process.argv[1] ?? "")) {
  main().catch(() => {
    process.stderr.write("The scan stopped on an unexpected error.\n");
    process.exitCode = EXIT_NO_SCORE;
  });
}
