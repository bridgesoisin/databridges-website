import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The internal factory is the only way to point the fetch layer at a local server, so it must stay reachable
// from tests alone. And rule 4 of the run: network access exists only inside fetch.ts.

const ROOT = path.resolve(__dirname, "../../..");
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx", ".sh", ".ps1"]);
const SKIPPED_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage", "reports"]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIPPED_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else if (CODE_EXTENSIONS.has(path.extname(entry))) out.push(full);
  }
  return out;
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

function isTestFile(file: string): boolean {
  const r = rel(file);
  return r.startsWith("tests/") || /\.test\.[cm]?[jt]sx?$/.test(r) || /\.spec\.[cm]?[jt]sx?$/.test(r);
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const FETCH_FILE = "src/lib/visibility/fetch.ts";
const productionFiles = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "scripts")), ...walk(path.join(ROOT, "netlify"))].filter(
  (file) => !isTestFile(file),
);

describe("test seam", () => {
  it("scans a meaningful set of files", () => {
    expect(productionFiles.length).toBeGreaterThan(10);
    expect(productionFiles.map(rel)).toContain(FETCH_FILE);
  });

  it("is defined once, in fetch.ts, and nowhere else in src/ or scripts/", () => {
    const mentions = productionFiles.filter((file) => readFileSync(file, "utf8").includes("_createFetcherCore")).map(rel);
    expect(mentions).toEqual([FETCH_FILE]);

    const source = readFileSync(path.join(ROOT, FETCH_FILE), "utf8");
    expect(source.match(/export function _createFetcherCore\b/g)).toHaveLength(1);
    expect(source.match(/_createFetcherCore/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("is used inside fetch.ts only to build the production fetcher", () => {
    const source = readFileSync(path.join(ROOT, FETCH_FILE), "utf8");
    const uses = [...source.matchAll(/_createFetcherCore\(/g)];
    expect(uses).toHaveLength(2);
    const tail = source.slice(source.indexOf("export function createGuardedFetcher"));
    expect(tail).toContain("return _createFetcherCore({");
    expect(tail).toContain("isBlocked: isBlockedAddress,");
    expect(tail).toContain("allowedPorts: DEFAULT_ALLOWED_PORTS,");
    expect(tail).toContain("limits: { ...PRODUCTION_LIMITS, deadlineMs },");
    expect(tail).not.toMatch(/\bca:/);
  });

  it("is imported only by files under tests/", () => {
    const importers = walk(ROOT)
      .filter((file) => readFileSync(file, "utf8").includes("_createFetcherCore"))
      .map(rel)
      .filter((file) => file !== FETCH_FILE && !file.startsWith("tests/") && !/\.test\.[cm]?[jt]sx?$/.test(file));
    expect(importers).toEqual([]);
  });
});

describe("network confinement", () => {
  const confined = productionFiles.filter((file) => {
    const r = rel(file);
    return r !== FETCH_FILE && (r.startsWith("src/lib/visibility/") || /^scripts\/visibility-scan\.[cm]?[jt]s$/.test(r) || r.startsWith("netlify/functions/visibility"));
  });

  const forbidden: Array<[string, RegExp]> = [
    ["node:http", /from\s+["'](node:)?https?["']|require\(\s*["'](node:)?https?["']\s*\)/],
    ["node:http2", /["'](node:)?http2["']/],
    ["node:tls", /["'](node:)?tls["']/],
    ["node:dns", /["'](node:)?dns(\/promises)?["']/],
    ["node:dgram", /["'](node:)?dgram["']/],
    ["child_process", /["'](node:)?child_process["']/],
    ["undici, axios, node-fetch, got", /["'](undici|axios|node-fetch|got|superagent|request)["']/],
    ["socket constructors", /\b(createConnection|new\s+(net\.)?Socket\b|net\.connect|tls\.connect)\b/],
    ["global fetch", /(?<![.\w$])fetch\s*\(/],
    ["XMLHttpRequest, WebSocket, EventSource", /\b(XMLHttpRequest|WebSocket|EventSource)\b/],
  ];

  it("covers the visibility modules", () => {
    const names = confined.map(rel);
    expect(names).toContain("src/lib/visibility/net-guard.ts");
    expect(names).toContain("src/lib/visibility/url.ts");
  });

  it.each(forbidden)("no visibility module other than fetch.ts uses %s", (_label, pattern) => {
    // types.ts only declares the Fetcher interface; its "fetch(" is a method signature, not a call.
    const offenders = confined
      .filter((file) => path.basename(file) !== "types.ts")
      .filter((file) => pattern.test(stripComments(readFileSync(file, "utf8"))))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("keeps the guard modules free of the clock and randomness too", () => {
    const guards = ["src/lib/visibility/net-guard.ts", "src/lib/visibility/url.ts"].map((f) => path.join(ROOT, f));
    for (const file of guards) {
      expect(/Date\.now\s*\(|new\s+Date\s*\(\s*\)|Math\.random\s*\(/.test(stripComments(readFileSync(file, "utf8"))), rel(file)).toBe(false);
    }
  });
});
