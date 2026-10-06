import { beforeAll, describe, expect, it } from "vitest";
import { evaluateSnapshot } from "@/lib/visibility/evaluate";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import { escapeMarkdown, renderJson, renderMarkdown } from "@/lib/visibility/report";
import { runScan } from "@/lib/visibility/scan";
import { CATEGORY_IDS, METRIC_IDS, type ScanReport } from "@/lib/visibility/types";
import { createFixtureFetcher, loadFixture } from "./helpers/fixture-fetcher";

const FORBIDDEN = /\b(rank(s|ed|ing)?|grade[sd]?|worst|league|leaderboard|best in|you will be cited|AI visibility score)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const HIDDEN = /[\u{0}-\u{8}\u{B}-\u{1F}\u{7F}-\u{9F}\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2060}-\u{2064}\u{2066}-\u{2069}\u{FEFF}]/u;
const NAMES = [
  "fx-strong",
  "fx-minimal",
  "fx-spa-shell",
  "fx-noindex-home",
  "fx-robots-block-all",
  "fx-canonical-variants",
  "fx-hostile",
] as const;

type Name = (typeof NAMES)[number];

async function reportFor(name: string): Promise<ScanReport> {
  const fixture = loadFixture(name);
  const snapshot = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), {
    now: new Date(fixture.site.scannedAt),
    scannerVersion: "scanner-9.9",
  });
  return evaluateSnapshot(snapshot, new Date(snapshot.scannedAt));
}

const reports = {} as Record<Name, ScanReport>;

beforeAll(async () => {
  for (const name of NAMES) reports[name] = await reportFor(name);
});

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n${heading}\n`);
  if (start < 0) throw new Error(`No section ${heading}`);
  const rest = markdown.slice(start + heading.length + 2);
  const next = rest.search(/\n#{1,3} /);
  return next < 0 ? rest : rest.slice(0, next);
}

function withScores(report: ScanReport, scores: Partial<ScanReport["scores"]>): ScanReport {
  return { ...report, scores: { ...report.scores, ...scores } };
}

describe("renderMarkdown: required scan facts", () => {
  it.each(NAMES)("%s: shows date and time in UTC, versions, pages, coverage, hash, limitations and correction route", (name) => {
    const report = reports[name];
    const md = renderMarkdown(report);

    expect(md).toContain("- Scan date and time (UTC): 2026-10-02 09:15:00 UTC");
    expect(md).toContain(`- Methodology version: ${report.methodologyVersion}`);
    expect(md).toContain("- Scanner version: scanner-9.9");
    expect(md).toContain(`- Pages sampled: ${report.pagesSampled.length}`);
    expect(md).toContain(`- Snapshot hash (SHA-256): ${report.snapshotHash}`);
    expect(report.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(md).toMatch(/- Coverage: \d+(\.\d)?%/);
    expect(md).toContain("## Limitations");
    for (const limitation of report.limitations) expect(md).toContain(`- ${escapeMarkdown(limitation)}`);
    expect(md).toContain("## Correction route");
    expect(md).toContain("oisin@databridges.ie");
    for (const page of report.pagesSampled) expect(md).toContain(escapeMarkdown(page.url, 2048));
  });

  it("formats coverage as a percentage of the stored fraction", () => {
    expect(renderMarkdown(reports["fx-strong"])).toContain("- Coverage: 100%");
    expect(renderMarkdown(reports["fx-spa-shell"])).toContain("- Coverage: 60.6%");
    expect(renderMarkdown(reports["fx-minimal"])).toContain("- Coverage: 95.2%");
    expect(renderMarkdown(reports["fx-robots-block-all"])).toContain("- Coverage: 0%");
  });

  it("repeats the key facts in the opening lines", () => {
    const head = renderMarkdown(reports["fx-strong"]).split("\n").slice(0, 6).join("\n");
    expect(head).toContain("Scanned: 2026-10-02 09:15:00 UTC");
    expect(head).toContain("Methodology 0.1.0-draft, scanner scanner-9.9, coverage 100%, 5 pages sampled.");
    expect(head).toContain("Site: https://fixture.example/");
  });

  it("states the draft status of a draft methodology", () => {
    expect(renderMarkdown(reports["fx-strong"])).toMatch(/draft methodology\. Results are engineering calibration results, not published claims/);
    const released = { ...reports["fx-strong"], methodologyVersion: "1.0.0" };
    expect(renderMarkdown(released)).not.toMatch(/draft methodology/);
  });

  it("falls back to the raw text for an unparseable scan time", () => {
    const md = renderMarkdown({ ...reports["fx-strong"], scannedAt: "yesterday-ish" });
    expect(md).toContain("- Scan date and time (UTC): yesterday-ish");
  });

  it("lists list versions and stale lists", () => {
    const md = renderMarkdown(reports["fx-strong"]);
    expect(md).toContain("- List versions: AI crawler list ");
    expect(md).toContain("- Lists unverified or past their review date: ");
    expect(renderMarkdown({ ...reports["fx-strong"], staleLists: [] })).toContain("- Lists unverified or past their review date: none");
  });
});

describe("renderMarkdown: scores, bands and findings", () => {
  it("shows overall, SEO and AEO with whole-number display, exact value and band", () => {
    const md = renderMarkdown(reports["fx-strong"]);
    expect(md).toContain("| Overall | 99 out of 100 | 99.40 | Strong signals detected |");
    expect(md).toContain("| SEO | 99 out of 100 | 98.80 | Strong signals detected |");
    expect(md).toContain("| AEO | 100 out of 100 | 100.00 | Strong signals detected |");
  });

  it("labels each band by the displayed whole number", () => {
    const base = reports["fx-strong"];
    const row = (overall: number) =>
      renderMarkdown(withScores(base, { overall })).split("\n").find((line) => line.startsWith("| Overall"));
    expect(row(84.5)).toContain("| 85 out of 100 | 84.50 | Strong signals detected |");
    expect(row(84.49)).toContain("| 84 out of 100 | 84.49 | Good foundations |");
    expect(row(69.5)).toContain("| 70 out of 100 | 69.50 | Good foundations |");
    expect(row(69.49)).toContain("| 69 out of 100 | 69.49 | Some gaps |");
    expect(row(49.5)).toContain("| 50 out of 100 | 49.50 | Some gaps |");
    expect(row(49.49)).toContain("| 49 out of 100 | 49.49 | Many gaps |");
  });

  it("withholds a score with its reason and shows no band for it", () => {
    const md = renderMarkdown(reports["fx-spa-shell"]);
    expect(md).toContain("| Overall | Withheld | - | - |");
    expect(md).toContain("| SEO | 87 out of 100 | 86.77 | Strong signals detected |");
    expect(md).toContain("| AEO | 65 out of 100 | 65.00 | Some gaps |");
    expect(md).toMatch(/- Overall score withheld\. Too little of the site could be observed: at least 70 of the 100 weight points/);
  });

  it("explains a withheld pillar and the dependent overall score", () => {
    const base = reports["fx-strong"];
    const md = renderMarkdown(
      withScores(base, {
        aeo: null,
        overall: null,
        withheld: { seo: null, aeo: "PILLAR_WEIGHT_BELOW_MINIMUM", overall: "PILLAR_NOT_PUBLISHED" },
      }),
    );
    expect(md).toMatch(/- AEO score withheld\. Too little of this pillar could be observed: at least 30 of its 50 weight points/);
    expect(md).toMatch(/- Overall score withheld\. The overall score needs both the SEO and the AEO score/);
    expect(md).toContain("| AEO | Withheld | - | - |");
  });

  it("puts critical findings before the scores, in neutral wording", () => {
    const md = renderMarkdown(reports["fx-noindex-home"]);
    const findings = md.indexOf("## Critical findings");
    const scores = md.indexOf("## Scores");
    expect(findings).toBeGreaterThan(0);
    expect(findings).toBeLessThan(scores);
    expect(section(md, "## Critical findings")).toMatch(/- \*\*CF-02\*\*: Detected: the homepage carries a noindex directive/);
    expect(section(md, "## Critical findings")).toContain("They do not change the scores.");
  });

  it("says plainly when no finding was triggered, without claiming the site is free of problems", () => {
    const text = section(renderMarkdown(reports["fx-strong"]), "## Critical findings");
    expect(text).toContain("None of the seven critical-finding checks was triggered by what the scanner could observe.");
    expect(text).not.toMatch(/\bno problems\b|\bsafe\b|\bhealthy\b/i);
  });

  it("lists every finding of a report", () => {
    const base = reports["fx-strong"];
    const md = renderMarkdown({
      ...base,
      criticalFindings: [
        { id: "CF-01", summary: "Detected: one." },
        { id: "CF-07", summary: "Detected: two." },
      ],
    });
    expect(md).toContain("- **CF-01**: Detected: one.");
    expect(md).toContain("- **CF-07**: Detected: two.");
  });
});

describe("renderMarkdown: categories and metrics", () => {
  it("renders all eight categories and all 52 metrics of a completed scan", () => {
    const md = renderMarkdown(reports["fx-minimal"]);
    for (const category of METHODOLOGY.categories) {
      expect(md).toContain(`### ${category.id} ${category.name} (${category.pillar})`);
    }
    for (const id of METRIC_IDS) {
      const rows = md.split("\n").filter((line) => line.startsWith(`| ${id} `));
      expect(rows, id).toHaveLength(1);
    }
    expect(CATEGORY_IDS).toHaveLength(8);
  });

  it("names each result in words, never by colour or symbol alone", () => {
    const md = renderMarkdown(reports["fx-minimal"]);
    const labels = new Set(
      md
        .split("\n")
        .filter((line) => /^\| [SA]\d\.\d\d /.test(line))
        .map((line) => line.split(" | ")[1]),
    );
    expect(labels.size).toBeGreaterThan(2);
    for (const label of labels) {
      expect(["Pass", "Partial", "Fail", "Not applicable", "Not observed", "Scan error"]).toContain(label);
    }
  });

  it("shows points against the maximum, and a dash where nothing was scored", () => {
    const md = renderMarkdown(reports["fx-minimal"]);
    const scored = reports["fx-minimal"].metrics.find((m) => m.result === "PARTIAL");
    const unscored = reports["fx-minimal"].metrics.find((m) => m.result === "NOT_OBSERVED" || m.result === "NOT_APPLICABLE");
    expect(scored).toBeDefined();
    expect(unscored).toBeDefined();
    const row = (id: string) => md.split("\n").find((line) => line.startsWith(`| ${id} `)) ?? "";
    expect(row(scored?.metricId ?? "")).toContain(`| ${scored?.points} / ${scored?.maxPoints} |`);
    expect(row(unscored?.metricId ?? "")).toContain("| - |");
  });

  it("gives Consider guidance for partial and failing metrics only", () => {
    const report = reports["fx-minimal"];
    const md = renderMarkdown(report);
    const weak = report.metrics.filter((m) => m.result === "PARTIAL" || m.result === "FAIL");
    const strong = report.metrics.filter((m) => m.result === "PASS");
    expect(weak.length).toBeGreaterThan(3);
    for (const metric of weak) {
      const guidance = METHODOLOGY.metrics.find((m) => m.id === metric.metricId)?.fixGuidance ?? "";
      expect(guidance).toMatch(/^Consider /);
      expect(md).toContain(`- ${metric.metricId}: ${escapeMarkdown(guidance, 400)}`);
    }
    for (const metric of strong) expect(md).not.toContain(`- ${metric.metricId}: Consider`);
    expect(md).not.toMatch(/\bwill (improve|increase|boost|raise|guarantee)\b/i);
  });

  it("gives no guidance block for a category whose metrics all pass", () => {
    const md = renderMarkdown(reports["fx-strong"]);
    const s1 = section(md, "### S1 Crawlability and indexation (SEO)");
    expect(s1).not.toContain("Guidance:");
  });

  it("shows a category with too little data as such and keeps its metrics visible", () => {
    const md = renderMarkdown(reports["fx-spa-shell"]);
    const s3 = section(md, "### S3 Technical health and speed basics (SEO)");
    expect(s3).toMatch(/Not enough data to show a score \(coverage 45%, minimum 50%\); left out of the aggregate scores \| Weight 10/);
    expect(s3).toContain("| S3.02 Valid TLS certificate | Pass |");
    const s1 = section(md, "### S1 Crawlability and indexation (SEO)");
    expect(s1).toMatch(/Score \d+(\.\d+)? out of 100 \| Coverage 100% \| Weight 15/);
  });

  it("describes what was seen from the evidence branches without dumping evidence", () => {
    const md = renderMarkdown(reports["fx-noindex-home"]);
    const row = md.split("\n").find((line) => line.startsWith("| S1.01 ")) ?? "";
    expect(row).toContain("noindex directive");
    expect(row.split(" | ").length).toBe(5);
    expect(md).not.toContain('"branch"');
  });

  it("reports informational signals as neutral facts", () => {
    const md = renderMarkdown(reports["fx-strong"]);
    const info = section(md, "## Informational signals");
    expect(info).toContain("Opting out of model training is a legitimate choice.");
    expect(info).toContain("| GPTBot | disallowed |");
    expect(info).toContain("| ClaudeBot | allowed |");
    expect(info).toContain("| ChatGPT-User | allowed |");
    expect(info).toContain("- Scanner challenged or blocked: no");
    expect(info).toMatch(/- JSON-LD types detected: .*FAQPage/);
    expect(info).toMatch(/- Homepage HTML size: \d+ bytes/);
    expect(info).toContain("- Homepage redirects: 0");
    const unknown = { ...reports["fx-strong"], informational: { ...reports["fx-strong"].informational, trainingCrawlerPolicy: [{ token: "GPTBot", allowed: null }], jsonLdTypes: [], homepageHtmlBytes: null, homepageRedirects: null } };
    const unknownMd = renderMarkdown(unknown);
    expect(unknownMd).toContain("| GPTBot | unknown (robots.txt could not be read) |");
    expect(unknownMd).toContain("- JSON-LD types detected: none");
    expect(unknownMd).toContain("- Homepage HTML size: not available");
  });
});

describe("renderMarkdown: outcomes without a score", () => {
  it("explains a robots.txt block without scores, categories or findings", () => {
    const report = reports["fx-robots-block-all"];
    const md = renderMarkdown(report);

    expect(report.outcome).toBe("BLOCKED_BY_ROBOTS");
    expect(md).toContain("Outcome: Not scanned: robots.txt disallows the scanner from the homepage.");
    expect(md).toContain("No score is given for this outcome.");
    expect(md).toContain("Critical findings were not assessed because the scan produced no score.");
    expect(md).toContain(escapeMarkdown(report.outcomeDetail ?? "", 300));
    expect(md).not.toContain("## Categories");
    expect(md).not.toContain("| Score | Value |");
    expect(md).not.toMatch(/out of 100/);
    expect(md).toContain("No pages were sampled.");
    expect(md).toContain("- Snapshot hash (SHA-256): ");
    expect(md).toContain("## Correction route");
    for (const limitation of report.limitations) expect(md).toContain(escapeMarkdown(limitation));
  });

  it("explains an unreachable site and a scan error the same way", () => {
    for (const outcome of ["UNREACHABLE", "JOB_ERROR"] as const) {
      const md = renderMarkdown({ ...reports["fx-robots-block-all"], outcome, outcomeDetail: "Detail text here." });
      expect(md).toContain("No score is given for this outcome.");
      expect(md).toContain("Detail text here.");
      expect(md).toContain(outcome === "UNREACHABLE" ? "the homepage could not be fetched" : "the scan stopped on an error");
    }
  });
});

describe("renderMarkdown: neutral wording", () => {
  it.each(NAMES)("%s: no ranking language, no emoji, no unrendered values", (name) => {
    const md = renderMarkdown(reports[name]);
    expect(md).not.toMatch(FORBIDDEN);
    expect(EMOJI.test(md)).toBe(false);
    expect(HIDDEN.test(md.replace(/\n/g, " "))).toBe(false);
    expect(md).not.toMatch(/\bundefined\b|\[object Object\]|\bNaN\b/);
    expect(md).not.toMatch(/\n{3,}/);
    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
  });

  it("never makes a claim about the business or an outcome promise", () => {
    for (const name of NAMES) {
      const md = renderMarkdown(reports[name]);
      expect(md).not.toMatch(/\b(guarantee|guaranteed|will rank|will be found|ensures? that you)\b/i);
    }
  });
});

describe("renderMarkdown: hostile text", () => {
  const HOSTILE = "<script>alert(1)</script> [click](javascript:alert(1)) `tick` **bold** _it_ | pipe\nnew line \u{202E}rtl \u{200B}zero & <b>x</b> ![img](http://evil)";

  function hostileReport(): ScanReport {
    const base = reports["fx-minimal"];
    return {
      ...base,
      homeUrl: `https://fixture.example/?q=${HOSTILE}`,
      scannerVersion: HOSTILE,
      criticalFindings: [{ id: "CF-02", summary: HOSTILE }],
      metrics: base.metrics.map((m, i) =>
        i === 0 ? { ...m, explanation: HOSTILE, evidence: [{ branch: HOSTILE }, { branch: HOSTILE }] } : m,
      ),
      pagesSampled: base.pagesSampled.map((p, i) => (i === 0 ? { ...p, url: `https://fixture.example/${HOSTILE}` } : p)),
      limitations: [HOSTILE, ...base.limitations],
      informational: {
        ...base.informational,
        jsonLdTypes: [HOSTILE],
        scannerRegion: HOSTILE,
        trainingCrawlerPolicy: [{ token: HOSTILE, allowed: true }],
      },
      outcomeDetail: HOSTILE,
    };
  }

  it("escapes markup, links and images, and keeps table rows on one line", () => {
    const md = renderMarkdown(hostileReport());

    expect(md).not.toContain("<script");
    expect(md).not.toContain("<b>");
    expect(md).not.toMatch(/(^|[^\\])\]\(javascript:/i);
    expect(md).not.toMatch(/(^|[^\\])\[click\]/);
    expect(md).not.toMatch(/(^|[^\\])!\[/);
    expect(md).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(md).toContain("\\[click\\](javascript");
    expect(HIDDEN.test(md.replace(/\n/g, " "))).toBe(false);

    for (const line of md.split("\n")) {
      if (!line.startsWith("|")) continue;
      const unescapedPipes = line.replace(/\\\|/g, "").match(/\|/g)?.length ?? 0;
      const cells = unescapedPipes - 1;
      expect([2, 3, 4, 5], line.slice(0, 60)).toContain(cells);
    }
    const metricRow = md.split("\n").find((line) => line.startsWith("| S1.01 ")) ?? "";
    expect(metricRow.replace(/\\\|/g, "").match(/\|/g)).toHaveLength(6);
  });

  it("bounds every escaped field", () => {
    const long = "A".repeat(10_000);
    const base = reports["fx-minimal"];
    const md = renderMarkdown({
      ...base,
      limitations: [long],
      criticalFindings: [{ id: "CF-01", summary: long }],
      metrics: base.metrics.map((m, i) => (i === 0 ? { ...m, explanation: long } : m)),
    });
    expect(md).not.toContain("A".repeat(401));
  });
});

describe("escapeMarkdown", () => {
  it("escapes the characters that carry meaning in Markdown and HTML", () => {
    expect(escapeMarkdown("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
    expect(escapeMarkdown("*bold* _it_ `code` [l](u) a|b ~x~ back\\slash")).toBe(
      "\\*bold\\* \\_it\\_ \\`code\\` \\[l\\](u) a\\|b \\~x\\~ back\\\\slash",
    );
  });

  it("strips control, bidi and zero-width characters and flattens whitespace", () => {
    expect(escapeMarkdown("a\u{202E}b\u{200B}c\u{0}d\te\nf")).toBe("abcd e f");
    expect(escapeMarkdown("   spaced     out   ")).toBe("spaced out");
  });

  it("caps length by characters", () => {
    expect(escapeMarkdown("x".repeat(500))).toHaveLength(400);
    expect(escapeMarkdown("x".repeat(500), 10)).toBe("xxxxxxxxxx");
    expect(escapeMarkdown("", 10)).toBe("");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeMarkdown("Plain sentence, with punctuation (and brackets): 2026-10-02.")).toBe(
      "Plain sentence, with punctuation (and brackets): 2026-10-02.",
    );
  });
});

describe("renderJson", () => {
  it.each(NAMES)("%s: parses back to exactly the report, with no raw page content", (name) => {
    const report = reports[name];
    const json = renderJson(report);
    expect(JSON.parse(json)).toEqual(report);
    expect(json.endsWith("}\n")).toBe(true);
    expect(json).toContain('\n  "reportVersion": 1,');
    expect(json).not.toMatch(/<!doctype|<html|<body/i);
  });

  it("carries the required facts and the contract keys", () => {
    const parsed = JSON.parse(renderJson(reports["fx-strong"])) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      reportVersion: 1,
      methodologyVersion: "0.1.0-draft",
      scannerVersion: "scanner-9.9",
      scannedAt: "2026-10-02T09:15:00.000Z",
      outcome: "COMPLETED",
      correctionRoute: "oisin@databridges.ie",
    });
    for (const key of ["snapshotHash", "coverage", "scores", "pagesSampled", "criticalFindings", "metrics", "informational", "limitations", "listVersions", "staleLists"]) {
      expect(parsed).toHaveProperty(key);
    }
    expect((parsed.metrics as unknown[]).length).toBe(52);
  });

  it("keeps the report's order of keys, so a diff of two reports is readable", () => {
    const keys = Object.keys(JSON.parse(renderJson(reports["fx-strong"])) as object);
    expect(keys.slice(0, 3)).toEqual(["reportVersion", "methodologyVersion", "scannerVersion"]);
  });
});

describe("rendering is deterministic", () => {
  it("renders the same bytes ten times, and from an independently rebuilt report", async () => {
    const report = reports["fx-strong"];
    const md = renderMarkdown(report);
    const json = renderJson(report);
    for (let i = 0; i < 10; i += 1) {
      expect(renderMarkdown(report)).toBe(md);
      expect(renderJson(report)).toBe(json);
    }
    const again = await reportFor("fx-strong");
    expect(renderMarkdown(again)).toBe(md);
    expect(renderJson(again)).toBe(json);
  });

  it("does not mutate the report it renders", () => {
    const report = reports["fx-minimal"];
    const before = JSON.stringify(report);
    renderMarkdown(report);
    renderJson(report);
    expect(JSON.stringify(report)).toBe(before);
  });
});
