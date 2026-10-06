import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateSnapshot } from "@/lib/visibility/evaluate";
import { EXTRA_HOSTS_ENV } from "@/lib/visibility/fetch";
import type { Resolver } from "@/lib/visibility/net-guard";
import { renderJson, renderMarkdown } from "@/lib/visibility/report";
import { createOwnAgentGate, runScan } from "@/lib/visibility/scan";
import type { ScanSnapshot } from "@/lib/visibility/types";
import {
  DEFAULT_OUT_DIR,
  EXIT_NO_SCORE,
  EXIT_OK,
  EXIT_REFUSED,
  EXIT_USAGE,
  parseArgs,
  runCli,
  type CliDeps,
} from "../../scripts/visibility-scan";
import { createFixtureFetcher, loadFixture } from "./helpers/fixture-fetcher";
import { armTripwire, type Tripwire } from "./helpers/net-observe";

const ROOT = path.resolve(__dirname, "../..");
const SCRIPT = path.join(ROOT, "scripts", "visibility-scan.ts");
const TSX_CLI = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const SCAN_TIME = new Date("2026-10-04T10:15:00.000Z");
const BANNED_WORDING = /\b(ranks?|ranking|grade|worst|AI visibility score)\b|you will be cited/i;

let tripwire: Tripwire;
let tmp: string;
const savedEnv = process.env[EXTRA_HOSTS_ENV];

beforeEach(() => {
  tripwire = armTripwire();
  delete process.env[EXTRA_HOSTS_ENV];
  tmp = mkdtempSync(path.join(os.tmpdir(), "visibility-cli-"));
});

afterEach(() => {
  tripwire.stop();
  vi.unstubAllGlobals();
  if (savedEnv === undefined) delete process.env[EXTRA_HOSTS_ENV];
  else process.env[EXTRA_HOSTS_ENV] = savedEnv;
  rmSync(tmp, { recursive: true, force: true });
});

function capture() {
  let out = "";
  let err = "";
  return {
    io: {
      out: (text: string) => {
        out += text;
      },
      err: (text: string) => {
        err += text;
      },
    },
    get stdout() {
      return out;
    },
    get stderr() {
      return err;
    },
  };
}

async function fixtureSnapshot(name: string): Promise<{ snapshot: ScanSnapshot; url: string }> {
  const fixture = loadFixture(name);
  const gate = createOwnAgentGate();
  const snapshot = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture, { robotsGate: gate.gate }), {
    now: new Date(fixture.site.scannedAt),
    scannerVersion: "cli-test",
    ownAgentGate: gate,
  });
  return { snapshot, url: fixture.site.inputUrl };
}

function depsReturning(snapshot: ScanSnapshot, extra: Omit<CliDeps, "scan"> = {}) {
  const scan = vi.fn<(url: string, now: Date) => Promise<ScanSnapshot>>(async () => snapshot);
  return { scan, now: () => SCAN_TIME, cwd: tmp, ...extra };
}

function filesIn(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

function parsedOptions(argv: string[]) {
  const result = parseArgs(argv);
  if (!result.ok) throw new Error(`expected ${JSON.stringify(argv)} to parse, got: ${result.error}`);
  return result.options;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

describe("parseArgs", () => {
  it("takes a URL and defaults to both reports in reports/", () => {
    expect(parsedOptions(["https://databridges.ie"])).toEqual({
      url: "https://databridges.ie",
      outDir: DEFAULT_OUT_DIR,
      json: true,
      md: true,
      help: false,
    });
    expect(DEFAULT_OUT_DIR).toBe("reports");
  });

  it("writes only the formats asked for", () => {
    expect(parsedOptions(["https://databridges.ie", "--json"])).toMatchObject({ json: true, md: false });
    expect(parsedOptions(["--md", "https://databridges.ie"])).toMatchObject({ json: false, md: true });
    expect(parsedOptions(["https://databridges.ie", "--md", "--json"])).toMatchObject({ json: true, md: true });
    expect(parsedOptions(["https://databridges.ie", "--json", "--json"])).toMatchObject({ json: true, md: false });
  });

  it("reads --out as a separate value or with an equals sign, before or after the URL", () => {
    expect(parsedOptions(["https://databridges.ie", "--out", "out/dir"]).outDir).toBe("out/dir");
    expect(parsedOptions(["--out=out/dir", "https://databridges.ie"]).outDir).toBe("out/dir");
    expect(parsedOptions(["--out", "x", "databridges.ie"])).toMatchObject({ url: "databridges.ie", outDir: "x" });
  });

  it("accepts help in either spelling without a URL", () => {
    expect(parsedOptions(["--help"]).help).toBe(true);
    expect(parsedOptions(["-h"]).help).toBe(true);
    expect(parsedOptions(["https://databridges.ie", "--help"]).help).toBe(true);
  });

  it("treats everything after -- as the URL", () => {
    expect(parsedOptions(["--json", "--", "https://databridges.ie"])).toMatchObject({ url: "https://databridges.ie", json: true });
    expect(parseArgs(["--", "--json"])).toMatchObject({ ok: true, options: { url: "--json" } });
  });

  it.each([
    [[], "A URL is required"],
    [["--json"], "A URL is required"],
    [["https://databridges.ie", "https://www.databridges.ie"], "exactly one URL"],
    [["https://databridges.ie", "--out"], "--out needs a directory"],
    [["https://databridges.ie", "--out", "--json"], "--out needs a directory"],
    [["https://databridges.ie", "--out="], "--out needs a directory"],
    [["https://databridges.ie", "--out", "a", "--out", "b"], "more than once"],
    [["https://databridges.ie", "--json=yes"], "does not take a value"],
    [["https://databridges.ie", "--md=1"], "does not take a value"],
    [["https://databridges.ie", "--format", "json"], "Unknown option --format"],
    [["https://databridges.ie", "-x"], "Unknown option -x"],
    [["-"], "Unknown option -"],
  ] as Array<[string[], string]>)("rejects %j", (argv, message) => {
    const result = parseArgs(argv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});

describe("the allowlist cannot be widened from the command line", () => {
  const widening = [
    ["--allow-host", "example.com"],
    ["--allow-host=example.com"],
    ["--allowed-hosts", "example.com"],
    ["--allowlist=example.com"],
    ["--host", "example.com"],
    ["--hosts=example.com"],
    ["--extra-hosts", "example.com"],
    ["--extra-host=example.com"],
    ["--domain", "example.com"],
    ["--any-host"],
    ["--no-allowlist"],
    ["--insecure"],
    ["--ignore-robots"],
    ["--no-robots"],
    ["--force"],
    ["--unsafe"],
    ["--timeout", "60"],
    ["--max-requests", "500"],
  ];
  const hinted = ["--allow-host", "--allowed-hosts", "--allowlist", "--host", "--extra-hosts", "--insecure", "--ignore-robots", "--no-robots", "--force", "--unsafe", "--timeout"];

  it.each(widening)("rejects %j as an unknown option", (...argv) => {
    const result = parseArgs(["https://example.com/", ...argv]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Unknown option /);
  });

  it.each(hinted)("tells the user that the safety checks are fixed when given %s", (flag) => {
    const result = parseArgs(["https://example.com/", flag, "x"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("cannot be changed from the command line");
  });

  it.each(widening)("exits with a usage error for %j before anything is scanned", async (...argv) => {
    const out = capture();
    const deps = depsReturning(await fixtureSnapshot("fx-strong").then((run) => run.snapshot));
    const code = await runCli(["https://example.com/", ...argv], out.io, deps);
    expect(code).toBe(EXIT_USAGE);
    expect(deps.scan).not.toHaveBeenCalled();
    expect(out.stdout).toBe("");
    expect(tripwire.attempts).toBe(0);
  });

  it("does not touch the allowlist, the environment or the internal fetch seam in the script itself", () => {
    const source = stripComments(readFileSync(SCRIPT, "utf8"));
    for (const forbidden of [
      "allowedHosts",
      "includeExtraHosts",
      "EXTRA_HOSTS",
      "VISIBILITY_EXTRA_HOSTS",
      "process.env",
      "_createFetcherCore",
      "createGuardedFetcher",
      "robotsGate",
    ]) {
      expect(source.includes(forbidden), `scripts/visibility-scan.ts mentions ${forbidden}`).toBe(false);
    }
  });
});

describe("refusing targets without any network access", () => {
  const notAllowlisted = [
    "https://example.com/",
    "example.org",
    "http://example.net/some/path",
    "https://databridges.ie.evil.example/",
    "https://evildatabridges.ie/",
    "https://sub.databridges.ie/",
    "https://www.www.databridges.ie/",
    "https://databridges.com/",
    "https://xn--databridges-5hf.ie/",
  ];

  it.each(notAllowlisted)("refuses %s through the real scanner: no lookup, no socket, no report", async (target) => {
    const resolver = vi.fn<Resolver>(async () => [{ address: "8.8.8.8", family: 4 }]);
    const liveFetch = vi.fn(() => {
      throw new Error("global fetch must not be used");
    });
    vi.stubGlobal("fetch", liveFetch);
    const out = capture();
    const outDir = path.join(tmp, "out");

    const code = await runCli([target, "--out", outDir], out.io, { resolver, now: () => SCAN_TIME, cwd: tmp });

    expect(code).toBe(EXIT_REFUSED);
    expect(out.stderr).toContain("Refused:");
    expect(out.stderr).toContain("not on the scan allowlist");
    expect(out.stderr).toContain("databridges.ie, www.databridges.ie");
    expect(out.stdout).toBe("");
    expect(resolver).not.toHaveBeenCalled();
    expect(liveFetch).not.toHaveBeenCalled();
    expect(tripwire.attempts).toBe(0);
    expect(existsSync(outDir)).toBe(false);
  });

  it.each([
    ["localhost", "RESERVED_HOSTNAME"],
    ["http://localhost:3000/", "RESERVED_HOSTNAME"],
    ["https://printer.local/", "RESERVED_HOSTNAME"],
    ["https://wiki.internal/", "RESERVED_HOSTNAME"],
    ["https://site.test/", "RESERVED_HOSTNAME"],
    ["http://127.0.0.1/", "IP_LITERAL_HOST"],
    ["http://[::1]/", "IP_LITERAL_HOST"],
    ["http://169.254.169.254/latest/meta-data", "IP_LITERAL_HOST"],
    ["https://user:secret@databridges.ie/", "USERINFO_NOT_ALLOWED"],
    ["ftp://databridges.ie/", "SCHEME_NOT_ALLOWED"],
    ["file:///etc/passwd", "SCHEME_NOT_ALLOWED"],
    ["https://databridges.ie:8443/", "PORT_NOT_ALLOWED"],
    ["", "EMPTY"],
    [`https://databridges.ie/${"a".repeat(2100)}`, "TOO_LONG"],
  ])("rejects the target %s (%s) before a scanner exists", async (target, reason) => {
    const resolver = vi.fn<Resolver>(async () => [{ address: "8.8.8.8", family: 4 }]);
    const out = capture();
    const deps = depsReturning(await fixtureSnapshot("fx-strong").then((run) => run.snapshot), { resolver });

    const code = await runCli([target.length > 0 ? target : "  "], out.io, deps);

    expect(code).toBe(EXIT_REFUSED);
    expect(out.stderr).toContain(reason);
    expect(out.stderr).toContain("Nothing was requested");
    expect(deps.scan).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
    expect(tripwire.attempts).toBe(0);
  });

  it("scans an allowlisted host, but the guard still refuses a private answer before connecting (exit 1, report written)", async () => {
    const resolver = vi.fn<Resolver>(async () => [{ address: "10.0.0.5", family: 4 }]);
    const out = capture();
    const outDir = path.join(tmp, "unreachable");

    const code = await runCli(["https://databridges.ie/", "--out", outDir], out.io, { resolver, now: () => SCAN_TIME, cwd: tmp });

    expect(code).toBe(EXIT_NO_SCORE);
    expect(resolver).toHaveBeenCalled();
    for (const call of resolver.mock.calls) expect(call[0]).toBe("databridges.ie");
    expect(tripwire.attempts).toBe(0);
    expect(out.stdout).toContain("Outcome: Homepage unreachable over https and http");
    expect(out.stdout).not.toContain("out of 100");
    const files = filesIn(outDir);
    expect(files).toHaveLength(2);
    const json = JSON.parse(readFileSync(path.join(outDir, files.find((f) => f.endsWith(".json")) as string), "utf8"));
    expect(json.outcome).toBe("UNREACHABLE");
    expect(json.scores.overall).toBeNull();
  });

  it("extends the allowlist only through the environment variable read inside the fetcher", async () => {
    const resolver = vi.fn<Resolver>(async () => [{ address: "10.0.0.5", family: 4 }]);

    const before = capture();
    expect(await runCli(["https://example.com/", "--out", path.join(tmp, "a")], before.io, { resolver, now: () => SCAN_TIME, cwd: tmp })).toBe(EXIT_REFUSED);
    expect(resolver).not.toHaveBeenCalled();

    process.env[EXTRA_HOSTS_ENV] = "example.com";
    const after = capture();
    const code = await runCli(["https://example.com/", "--out", path.join(tmp, "b")], after.io, { resolver, now: () => SCAN_TIME, cwd: tmp });
    expect(code).toBe(EXIT_NO_SCORE);
    expect(after.stderr).not.toContain("not on the scan allowlist");
    expect(resolver).toHaveBeenCalled();
    expect(tripwire.attempts).toBe(0);
  });
});

describe("reports, summary and exit codes", () => {
  it("writes JSON and Markdown named after the host, time and snapshot hash, and exits 0", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-strong");
    const out = capture();
    const deps = depsReturning(snapshot);

    const code = await runCli([url], out.io, deps);

    expect(code).toBe(EXIT_OK);
    expect(deps.scan).toHaveBeenCalledWith(url, SCAN_TIME);
    const reportsDir = path.join(tmp, "reports");
    const files = filesIn(reportsDir);
    expect(files).toHaveLength(2);
    for (const file of files) expect(file).toMatch(/^visibility-fixture\.example-20261002T091500Z-[0-9a-f]{8}\.(json|md)$/);

    const report = evaluateSnapshot(snapshot);
    const json = files.find((file) => file.endsWith(".json")) as string;
    const markdown = files.find((file) => file.endsWith(".md")) as string;
    expect(json).toContain(report.snapshotHash.slice(0, 8));
    expect(readFileSync(path.join(reportsDir, json), "utf8")).toBe(renderJson(report));
    expect(readFileSync(path.join(reportsDir, markdown), "utf8")).toBe(renderMarkdown(report));
    expect(out.stderr).toBe("");
  });

  it("prints a short summary with the facts plan 4.7 requires and none of the avoided wording", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-strong");
    const out = capture();
    await runCli([url], out.io, depsReturning(snapshot));
    const report = evaluateSnapshot(snapshot);

    expect(out.stdout).toContain(`Methodology ${report.methodologyVersion}`);
    expect(out.stdout).toContain("Scanned: 2026-10-02 09:15:00 UTC");
    expect(out.stdout).toMatch(/Overall: \d+ out of 100 \([A-Za-z ]+\)/);
    expect(out.stdout).toMatch(/SEO: \d+ out of 100/);
    expect(out.stdout).toMatch(/AEO: \d+ out of 100/);
    expect(out.stdout).toContain("Coverage: 100% of the metric weight could be observed; 5 pages sampled");
    expect(out.stdout).toContain("Limitations: ");
    expect(out.stdout).toContain("Corrections: oisin@databridges.ie");
    expect(out.stdout).toContain("Wrote: reports");
    expect(out.stdout.split("\n").length).toBeLessThan(25);
    expect(out.stdout).not.toMatch(BANNED_WORDING);
  });

  it("writes only the JSON report with --json and only the Markdown report with --md", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-strong");

    await runCli([url, "--json", "--out", "only-json"], capture().io, depsReturning(snapshot));
    expect(filesIn(path.join(tmp, "only-json")).map((file) => path.extname(file))).toEqual([".json"]);

    await runCli([url, "--md", "--out", "only-md"], capture().io, depsReturning(snapshot));
    expect(filesIn(path.join(tmp, "only-md")).map((file) => path.extname(file))).toEqual([".md"]);
  });

  it("creates a nested output directory", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-strong");
    const code = await runCli([url, "--out", path.join("a", "b", "c")], capture().io, depsReturning(snapshot));
    expect(code).toBe(EXIT_OK);
    expect(filesIn(path.join(tmp, "a", "b", "c"))).toHaveLength(2);
  });

  it("reports a withheld overall score and the critical finding, and still exits 0", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-spa-shell");
    const out = capture();
    const code = await runCli([url], out.io, depsReturning(snapshot));
    expect(code).toBe(EXIT_OK);
    expect(out.stdout).toMatch(/Overall: withheld \(.+\)/);
    expect(out.stdout).toContain("CF-04");
    expect(out.stdout).not.toMatch(BANNED_WORDING);
  });

  it("exits 1 and still writes a report when robots.txt blocks the scanner", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-robots-block-all");
    expect(snapshot.outcome).toBe("BLOCKED_BY_ROBOTS");
    const out = capture();
    const code = await runCli([url], out.io, depsReturning(snapshot));
    expect(code).toBe(EXIT_NO_SCORE);
    expect(out.stdout).toContain("Outcome: Blocked by robots.txt");
    expect(out.stdout).not.toContain("out of 100");
    expect(out.stdout).toContain("Corrections: oisin@databridges.ie");
    expect(filesIn(path.join(tmp, "reports"))).toHaveLength(2);
  });

  it("exits 1 when the homepage is unreachable", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-strong");
    const unreachable: ScanSnapshot = { ...snapshot, outcome: "UNREACHABLE", outcomeDetail: "The homepage could not be fetched over https or http.", pages: [] };
    const out = capture();
    expect(await runCli([url], out.io, depsReturning(unreachable))).toBe(EXIT_NO_SCORE);
    expect(out.stdout).toContain("Homepage unreachable");
  });

  it("exits 1 when the scan stops on a job error, or the scanner throws", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-strong");
    const jobError: ScanSnapshot = { ...snapshot, outcome: "JOB_ERROR", outcomeDetail: "The scan stopped on an unexpected error: boom", pages: [] };
    expect(await runCli([url], capture().io, depsReturning(jobError))).toBe(EXIT_NO_SCORE);

    const out = capture();
    const outDir = path.join(tmp, "thrown");
    const deps: CliDeps = { scan: async () => Promise.reject(new Error("socket hang up")), now: () => SCAN_TIME, cwd: tmp };
    expect(await runCli([url, "--out", outDir], out.io, deps)).toBe(EXIT_NO_SCORE);
    expect(out.stderr).toContain("socket hang up");
    expect(existsSync(outDir)).toBe(false);
  });

  it("exits 1 without writing when the snapshot cannot be evaluated", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-strong");
    const out = capture();
    const outDir = path.join(tmp, "corrupt");
    const code = await runCli([url, "--out", outDir], out.io, depsReturning({ ...snapshot, scannedAt: "not a date" }));
    expect(code).toBe(EXIT_NO_SCORE);
    expect(out.stderr).toContain("could not be evaluated");
    expect(existsSync(outDir)).toBe(false);
  });

  it("warns, without refusing, when the output directory is inside the project but outside reports/", async () => {
    const { snapshot, url } = await fixtureSnapshot("fx-strong");

    const inside = capture();
    expect(await runCli([url, "--out", "scratch"], inside.io, depsReturning(snapshot))).toBe(EXIT_OK);
    expect(inside.stderr).toContain("not under reports/");
    expect(inside.stderr).toContain("do not commit");

    const reports = capture();
    expect(await runCli([url], reports.io, depsReturning(snapshot))).toBe(EXIT_OK);
    expect(reports.stderr).toBe("");

    const outside = capture();
    expect(await runCli([url, "--out", path.join(os.tmpdir(), `visibility-cli-elsewhere-${process.pid}`)], outside.io, depsReturning(snapshot, { cwd: tmp }))).toBe(EXIT_OK);
    expect(outside.stderr).toBe("");
    rmSync(path.join(os.tmpdir(), `visibility-cli-elsewhere-${process.pid}`), { recursive: true, force: true });
  });

  it("prints the help text and exits 0 without scanning", async () => {
    const out = capture();
    const deps = depsReturning((await fixtureSnapshot("fx-strong")).snapshot);
    expect(await runCli(["--help"], out.io, deps)).toBe(EXIT_OK);
    expect(out.stdout).toContain("Usage: tsx scripts/visibility-scan.ts <url>");
    expect(out.stdout).toContain("databridges.ie and www.databridges.ie");
    expect(out.stdout).toContain("no option changes that");
    expect(deps.scan).not.toHaveBeenCalled();
  });
});

describe("command line entry point", () => {
  function run(args: string[]) {
    return spawnSync(process.execPath, [TSX_CLI, SCRIPT, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, [EXTRA_HOSTS_ENV]: "" },
    });
  }

  it("prints help and exits 0", () => {
    const result = run(["--help"]);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("Usage: tsx scripts/visibility-scan.ts <url>");
  }, 120_000);

  it("exits 2 on bad arguments and on an attempt to widen the allowlist", () => {
    expect(run([]).status).toBe(EXIT_USAGE);
    const widened = run(["--allow-host", "example.com", "https://example.com/"]);
    expect(widened.status).toBe(EXIT_USAGE);
    expect(widened.stderr).toContain("cannot be changed from the command line");
  }, 120_000);

  it("exits 3 for a rejected target and makes no request", () => {
    const result = run(["http://localhost:3000/"]);
    expect(result.status).toBe(EXIT_REFUSED);
    expect(result.stderr).toContain("RESERVED_HOSTNAME");
    expect(result.stdout).toBe("");
  }, 120_000);
});
