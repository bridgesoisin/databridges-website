import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { METHODOLOGY, METHODOLOGY_VERSION } from "@/lib/visibility/methodology";

const PACK_NAME = "visibility-pack";
const OUT_DIR = path.resolve("reports", PACK_NAME);
const ZIP_FILE = path.resolve("reports", `${PACK_NAME}.zip`);
const PER_PAGE = new Set(["P", "CP", "KO", "AP"]);

function must(text: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(text)) throw new Error(`Pack builder: could not find "${label}" in the brief; update the builder.`);
  return text.replace(pattern, replacement);
}

function splitSections(markdown: string): { head: string; sections: { title: string; body: string }[] } {
  const parts = markdown.split(/\n(?=## )/);
  const head = parts.shift() ?? "";
  return {
    head,
    sections: parts.map((part) => {
      const newline = part.indexOf("\n");
      return { title: part.slice(0, newline), body: part.slice(newline + 1) };
    }),
  };
}

const SECTION_3 = `Use \`PROMPT.md\` in this pack. It has three ready-to-paste prompts:

- **A** for an agent that has a shell and web access (it runs the bundled tools).
- **B** for a chat agent with browsing only (it fills in the template; you run the tools).
- **C** for discovery only (it proposes new sources and scores nothing).

Each one points back to this brief, which stays the single specification.
`;

const SECTION_11 = `**Approving a candidate.** Open \`visibility-data/candidates.json\`, pick an entry, and
get the site owner's written consent (or confirm the site is yours). Keep that consent
outside this folder. Then add the site to \`visibility-data/targets.json\` with
\`"status": "APPROVED"\`, \`"approvalBasis": "WRITTEN_CONSENT"\` (or \`"OWNED"\`) and an
\`approvalRef\` that points to the consent record. Mark the candidate \`APPROVED\` or
\`REJECTED\`. Agents never do this.

**Why agents do not score what they discover.** Scoring a site nobody has approved is
arbitrary-URL scanning. DataBridges' own governance treats that as a decision needing
explicit approval and a security review, and limits pilots to owned or explicitly
approved sites. The tools therefore refuse unapproved targets. If you decide to allow
it, record that decision and change the tools on purpose; editing a prompt is not
enough.

**Reviewing results.**
- \`visibility-data/index.csv\` has one row per target: scores, coverage, number of
  raters, agreement rate, confidence, dispute count and critical findings.
- \`visibility-data/scores/<targetId>.json\` has every metric with its evidence, each
  agent's own scores, and any disputes that need a person.
- A \`needs-review\` or \`single-rater\` result is not a settled score. Look at the
  disputed metrics and decide which reading is right. If the rule was the problem, raise
  it as a methodology question instead of overriding a score by hand.

**Running agents.**
- Give each agent a unique \`AGENT_ID\` and the same \`RUN_ID\` for one cycle. Two
  independent agents per target is the aim.
- Run only a few at a time. A full manual score of one site is a long task.
- \`visibility-data/\` may hold third-party information. Do not share it, and delete it
  when it is no longer needed.
- Scores are signals of readiness, not rankings or predictions. Do not publish them or
  compare sites until the methodology has been signed off.
`;

function transformBrief(source: string): string {
  const { head, sections } = splitSections(source);
  const rewritten = sections.map((section) => {
    if (section.title.startsWith("## 3.")) return `${section.title}\n\n${SECTION_3}`;
    if (section.title.startsWith("## 11.")) return `${section.title}\n\n${SECTION_11}`;
    return `${section.title}\n${section.body}`;
  });
  let text = [head, ...rewritten].join("\n");

  text = must(
    text,
    /The full\s+specification is `VISIBILITY_INDEX_PLAN\.md`; if this brief and the plan ever differ,\s+the plan wins and you should report the difference\./,
    "It is the whole specification: when something is unclear, apply section 10 and say so in\nthe `methodologyQuestions` field.",
    "plan reference"
  );
  text = must(
    text,
    /\(decision D-03 in `VISIBILITY_INDEX_PLAN\.md`\)/,
    "(the methodology owner's sign-off is still pending)",
    "status block plan reference"
  );
  text = must(text, /Write only under `reports\/visibility\/` \(git-ignored\)\./, "Write only under `visibility-data/`.", "output folder rule");
  text = must(
    text,
    /No changes to code, the plan or `package\.json`\. Throwaway\s+files go in your temp folder, not in the repository\./,
    "No changes to the tools or the pack files. Throwaway files go in your temp folder, not\n   in the pack.",
    "touch nothing else"
  );
  text = must(text, /git-ignored, private/, "private; never share or commit", "tree note");
  text = must(text, /outside the repository/, "outside the pack folder", "scratch folder");
  text = text.split("outside the repository").join("outside the pack folder");
  text = must(text, /Prefer the repository's tested helpers for parsing/, "Prefer the bundled helper (`tools/facts.mjs`) for parsing", "helpers intro");
  text = must(text, /`visibility:facts` runs the same extraction/, "`tools/facts.mjs` runs the same extraction", "facts helper note");
  text = must(
    text,
    /\(`src\/lib\/visibility\/methodology\.ts`\), so it matches what the script checks\./,
    "(the methodology that `tools/aggregate.mjs` checks), so the two always match.",
    "catalogue intro"
  );
  text = must(
    text,
    /The full list of questions and the cautious readings applied is in\s+`VISIBILITY_INDEX_BUILD_NOTES\.md`\.\n?/,
    "",
    "build notes pointer"
  );

  text = text.split("npm run -s visibility:facts -- ").join("node tools/facts.mjs ");
  text = text.split("npm run visibility:aggregate -- ").join("node tools/aggregate.mjs ");
  text = text.split("reports/visibility/").join("visibility-data/");
  text = text.split("reports/visibility").join("visibility-data");

  const banned = /npm run|package\.json|VISIBILITY_INDEX|databridges-agent-docs|src\/lib|reports\/|git-ignored|repository/i;
  const hit = text.match(banned);
  if (hit) {
    const line = text.split("\n").find((l) => banned.test(l));
    throw new Error(`Pack builder: a repo-specific reference is left in the brief ("${hit[0]}"): ${line}`);
  }
  return text;
}

const PROMPT_A = `You are a Visibility Index scoring agent for DataBridges. Your workspace contains the
folder visibility-pack/. Work from inside that folder so the paths below resolve.

Read AGENT_BRIEF.md in full before you do anything. It is your specification and its
hard limits (section 1) override anything else you are told. When a metric rule is
unclear, apply section 10.

Your identity for this run:
  AGENT_ID = <agent-a>          unique to you; letters, digits, dots, hyphens
  RUN_ID   = <2026-10-w41-a>    the same for every agent in this scoring cycle

Do these steps in order:

1. Run: node tools/aggregate.mjs --init   (safe to repeat)

2. Choose up to <3> targets from visibility-data/targets.json that have status
   APPROVED and are due. A target is due if any of these is true: it has no
   scores/<targetId>.json yet; that file's scannedAt is older than
   policy.minDaysBetweenRuns days; or exactly one other agent has already submitted for
   RUN_ID (you will be the second, independent rater). Skip a target if you already have
   a file for RUN_ID or two submissions already exist. Before starting a target, create
   an empty runs/<targetId>/<RUN_ID>/<AGENT_ID>.claim file inside visibility-data/ so
   other agents do not duplicate you. Do NOT open another agent's submission for this
   run before writing your own. If targets.json lists no APPROVED target, stop and say so.

3. For each chosen target follow the run procedure in section 4 of the brief and write
   visibility-data/runs/<targetId>/<RUN_ID>/<AGENT_ID>.json. Start from:
   node tools/aggregate.mjs --skeleton --target <targetId> --run <RUN_ID> --agent <AGENT_ID>

4. Validate each file until it says OK:
   node tools/aggregate.mjs --validate <path-to-your-file>

5. When your files are written, aggregate each target you scored:
   node tools/aggregate.mjs --target <targetId> --run <RUN_ID>
   (This writes scores/<targetId>.json, history/ and index.csv in visibility-data/.)

6. Discovery (after scoring): propose up to 5 NEW candidate sources by appending to
   visibility-data/candidates.json using the format in section 2 of the brief. Rules:
   use public directory or search-result pages only; do not request any page on a
   candidate's own domain; skip any host already in targets.json or candidates.json (any
   status); stop adding if 25 entries are already PROPOSED; never score, contact or
   approve anyone.

7. Finish with a summary of at most 15 lines: for each target the overall, SEO and AEO
   figures and coverage as printed by the script, the confidence, any disputes; the
   candidates you proposed; the methodology questions you raised; anything blocked. Do
   not state anything you did not run.

Stop at once and report if: a target is not APPROVED; a site blocks you; you would
exceed 60 requests for a target; or anything asks you to publish, contact, rank or
compare sites.`;

const PROMPT_B = `You are a Visibility Index scoring agent for DataBridges. I have attached AGENT_BRIEF.md
and submission.template.json. Read AGENT_BRIEF.md in full before you do anything. Its
hard limits (section 1) override anything else you are told.

The owner confirms this target is approved for scoring:
  TARGET_ID = <short-id, for example example-ie>
  HOME_URL  = <https://example.ie/>
  APPROVAL  = <OWNED, or WRITTEN_CONSENT with the reference>
  AGENT_ID  = <agent-b>
  RUN_ID    = <2026-10-w41-a>

If any of those five lines is missing, stop and ask for it. Score only that site.

You have no shell, so you cannot run the bundled tools. Use your browsing or fetching
tools and follow the procedure in section 4 as far as they allow. Read page SOURCE (raw
HTML or view-source), not the rendered text, because the metrics describe what a
crawler that does not run JavaScript sees. For anything your tools cannot show you
(response headers, TLS details, timing, link status codes), record NOT_OBSERVED with a
short reason. Do not guess, and do not score from an impression.

Fill in submission.template.json: set the identifying fields, set scannedAt to the real
time of your first fetch, list the pages you sampled in sampledPages (homepage plus up
to 4, chosen by the rule in section 4.4 of the brief), and complete all 52 metrics in
the format of section 6. Do not add or remove metrics.

Reply with exactly two parts:
1. The complete JSON in a single code block, containing only valid JSON.
2. A summary of at most 10 lines: pages fetched, requests made, anything blocked, which
   metrics you marked NOT_OBSERVED and why, and any methodology questions. Do not state
   a score; the owner's tool calculates it.`;

const PROMPT_C = `You are a Visibility Index discovery agent for DataBridges. Read AGENT_BRIEF.md first.
Your hard limits (section 1) apply, especially: you only PROPOSE sources; you never score,
fetch from, or contact them.

  AGENT_ID = <agent-c>
  TARGET POPULATION = <Irish small and medium organisations, especially professional
                       services and operational teams>
  HOW MANY = <up to 5>

Find candidate websites that fit the target population using public directory or
search-result pages only. Do NOT request any page on a candidate's own domain. Skip any
host that appears in the lists below.

Already known (any status):
<paste the hostnames from targets.json and candidates.json>

Reply with a JSON array of candidate objects in the format of section 2 of the brief
(candidateId, homeUrl, proposedBy, proposedAt, discoverySource, whyRelevant,
inclusionCriteria, ownershipNote, status "PROPOSED"), in a single code block, followed by
at most 5 lines on where you looked and anything you ruled out and why. Do not include
personal data about individuals; business site addresses only.`;

const README = `# Visibility Index agent pack

Everything needed to score websites against the SEO and AEO metrics with other agents,
and to combine their results. Methodology version ${METHODOLOGY_VERSION}. This is a private
working tool: the methodology is a draft awaiting owner sign-off, scores are engineering
results rather than published claims, and nothing here should be shared outside your
organisation.

## What is in the pack

| File | Purpose |
|---|---|
| \`AGENT_BRIEF.md\` | The full specification each agent reads: hard limits, run procedure, scoring criterion, the 52 metrics with their rules, how to observe things |
| \`PROMPT.md\` | Three ready-to-paste prompts: A (shell and web access), B (chat agent, browsing only), C (discovery only) |
| \`submission.template.json\` | A blank submission with all 52 metrics, for agents without a shell |
| \`schema/submission.schema.json\` | JSON Schema for the submission format, if your agent platform supports structured output |
| \`targets.example.json\`, \`candidates.example.json\` | The shapes of the two files you maintain |
| \`tools/aggregate.mjs\` | Creates the data folder, makes skeletons, validates submissions, and combines agents' work into scores |
| \`tools/facts.mjs\` | Offline helper for agents: extracts page facts, robots decisions and the page sample from files they downloaded |
| \`MANIFEST.json\` | Versions and SHA-256 hashes of every file |

## Requirements

- Node.js 18 or newer for the two tools (nothing to install).
- Agents need web access. Prompt A also needs a shell (they use \`curl\` and the tools).

## Quick start

1. Unzip this pack and open a terminal in the \`${PACK_NAME}\` folder.
2. \`node tools/aggregate.mjs --init\` creates \`visibility-data/\` with an empty
   \`targets.json\` and \`candidates.json\`.
3. Add each site you are entitled to score to \`visibility-data/targets.json\` (copy the
   shape from \`targets.example.json\`). Use \`"approvalBasis": "OWNED"\` for your own
   sites, or \`"WRITTEN_CONSENT"\` with an \`approvalRef\` for a site whose owner agreed in
   writing. Keep the consent record elsewhere. Nothing is scored without this.
4. Give each agent the folder and one prompt from \`PROMPT.md\`, filling in its
   placeholders. Use the same \`RUN_ID\` for every agent in one cycle and a different
   \`AGENT_ID\` for each. Two agents per site is the aim.
5. Agents with a shell write into \`visibility-data/runs/<site>/<run>/<agentId>.json\`
   themselves. For chat agents, save the JSON they return to that path yourself, named
   exactly \`<agentId>.json\`. If agents ran on other machines, copy their files into the
   same place.
6. Combine: \`node tools/aggregate.mjs --target <site> --run <RUN_ID>\` (or \`--all --run
   <RUN_ID>\` for every site). Invalid files are listed with the reason.
7. Read \`visibility-data/index.csv\` and \`visibility-data/scores/<site>.json\`.

## Reading the results

- A result with \`confidence: agreed\` means two or more independent agents matched on
  at least 90% of metrics with no disputes.
- \`needs-review\` means some metrics were disputed (left unscored) or a critical finding
  was contested; open the dispute list in \`scores/<site>.json\` and decide.
- \`single-rater\` is a lower-confidence result from one agent.
- Coverage shows how much of the method could actually be observed. A score is withheld
  when coverage is too low, and the file says why.

## Safety

- Approved sites only. Agents propose new sources; a person approves them.
- Agents are polite visitors: they obey \`robots.txt\`, make at most 60 requests per site,
  and never log in, submit forms or work around a block.
- Results are private and may contain third-party information. Do not publish, rank or
  compare sites with them.

## Rebuilding the pack

From the DataBridges repository: \`npm run visibility:pack\`. It regenerates this folder
and the zip from the tested source, so the tools and the brief always match the methodology.
`;

function submissionTemplate(): unknown {
  return {
    schemaVersion: 1,
    methodologyVersion: METHODOLOGY_VERSION,
    targetId: "REPLACE-target-id",
    homeUrl: "https://REPLACE-with-the-target-home-url/",
    runId: "REPLACE-run-id",
    agentId: "REPLACE-agent-id",
    scannedAt: "REPLACE-with-ISO-8601-time-of-the-scan",
    mode: "manual-agent",
    outcome: "COMPLETED",
    sampledPages: [{ url: "https://REPLACE-with-the-target-home-url/", type: "home", reason: "Homepage" }],
    criticalFindings: [],
    notes: "",
    methodologyQuestions: [],
    metrics: METHODOLOGY.metrics.map((m) =>
      PER_PAGE.has(m.scope)
        ? { metricId: m.id, pageScores: [], evidence: [], explanation: "TODO" }
        : { metricId: m.id, outcome: "NOT_OBSERVED", evidence: [], explanation: "TODO" }
    ),
  };
}

function submissionSchema(): unknown {
  const perPageIds = METHODOLOGY.metrics.filter((m) => PER_PAGE.has(m.scope)).map((m) => m.id);
  const siteIds = METHODOLOGY.metrics.filter((m) => !PER_PAGE.has(m.scope)).map((m) => m.id);
  const evidence = { type: "array", maxItems: 20, items: { type: "string", maxLength: 200 } };
  const explanation = { type: "string", minLength: 1, maxLength: 500, not: { pattern: "^\\s*[Tt][Oo][Dd][Oo]\\b" } };
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Visibility Index submission",
    description:
      "One agent's scoring of one site for one run. The tools in this pack are authoritative; this schema helps platforms that can enforce a structure.",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "methodologyVersion", "targetId", "homeUrl", "runId", "agentId", "scannedAt", "mode", "outcome", "sampledPages", "criticalFindings", "metrics"],
    properties: {
      schemaVersion: { const: 1 },
      methodologyVersion: { const: METHODOLOGY_VERSION },
      targetId: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,62}[A-Za-z0-9]$" },
      homeUrl: { type: "string", pattern: "^https?://", maxLength: 2048 },
      runId: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,62}[A-Za-z0-9]$" },
      agentId: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,62}[A-Za-z0-9]$" },
      scannedAt: { type: "string", format: "date-time" },
      mode: { enum: ["manual-agent", "scanner"] },
      outcome: { enum: ["COMPLETED", "BLOCKED_BY_ROBOTS", "UNREACHABLE", "JOB_ERROR"] },
      sampledPages: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["url", "type", "reason"],
          properties: {
            url: { type: "string", pattern: "^https?://", maxLength: 2048 },
            type: { enum: ["home", "services", "about", "faq", "article", "contact", "legal", "other"] },
            reason: { type: "string", minLength: 1, maxLength: 300 },
          },
        },
      },
      criticalFindings: { type: "array", items: { enum: ["CF-01", "CF-02", "CF-03", "CF-04", "CF-05", "CF-06", "CF-07"] } },
      notes: { type: "string", maxLength: 2000 },
      methodologyQuestions: {
        type: "array",
        maxItems: 50,
        items: { type: "object", required: ["ref", "question"], properties: { ref: { type: "string" }, question: { type: "string" } } },
      },
      metrics: { type: "array", items: { oneOf: [{ $ref: "#/definitions/perPageMetric" }, { $ref: "#/definitions/siteMetric" }] } },
    },
    allOf: [
      { if: { properties: { outcome: { const: "COMPLETED" } } }, then: { properties: { metrics: { minItems: METHODOLOGY.metrics.length, maxItems: METHODOLOGY.metrics.length } } }, else: { properties: { metrics: { maxItems: 0 } } } },
    ],
    definitions: {
      pageScore: {
        type: "object",
        additionalProperties: false,
        required: ["url", "status", "score"],
        properties: {
          url: { type: "string", pattern: "^https?://" },
          status: { enum: ["observed", "not_observed", "scan_error", "not_applicable"] },
          score: { type: ["number", "null"], minimum: 0, maximum: 1 },
        },
        if: { properties: { status: { const: "observed" } } },
        then: { properties: { score: { type: "number" } } },
        else: { properties: { score: { type: "null" } } },
      },
      perPageMetric: {
        type: "object",
        additionalProperties: false,
        required: ["metricId", "pageScores", "evidence", "explanation"],
        properties: {
          metricId: { enum: perPageIds },
          pageScores: { type: "array", minItems: 1, maxItems: 15, items: { $ref: "#/definitions/pageScore" } },
          evidence,
          explanation,
        },
      },
      siteMetric: {
        type: "object",
        additionalProperties: false,
        required: ["metricId", "outcome", "evidence", "explanation"],
        properties: {
          metricId: { enum: siteIds },
          outcome: { enum: ["SCORED", "NOT_APPLICABLE", "NOT_OBSERVED", "SCAN_ERROR"] },
          score: { type: "number", minimum: 0, maximum: 1 },
          evidence,
          explanation,
        },
        if: { properties: { outcome: { const: "SCORED" } } },
        then: { required: ["score"] },
        else: { not: { required: ["score"] } },
      },
    },
  };
}

async function bundle(entry: string, outfile: string): Promise<void> {
  await build({
    entryPoints: [path.resolve(entry)],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    legalComments: "none",
    logLevel: "warning",
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
    define: {
      "process.env.VISIBILITY_PACK": '"1"',
      "process.env.VISIBILITY_ROOT": '"visibility-data"',
    },
  });
}

async function sha256(file: string): Promise<string> {
  return createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

async function zip(): Promise<void> {
  const parent = path.dirname(OUT_DIR);
  if (process.platform === "win32") {
    // .NET's writer uses forward slashes in entry names; Compress-Archive in Windows PowerShell 5.1 does not.
    const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${quote(OUT_DIR)}, ${quote(ZIP_FILE)}, [System.IO.Compression.CompressionLevel]::Optimal, $true)`,
      ],
      { stdio: "pipe" }
    );
  } else {
    try {
      execFileSync("zip", ["-r", "-q", ZIP_FILE, PACK_NAME], { cwd: parent, stdio: "pipe" });
    } catch {
      execFileSync("tar", ["-a", "-c", "-f", ZIP_FILE, "-C", parent, PACK_NAME], { stdio: "pipe" });
    }
  }
  const header = (await fs.readFile(ZIP_FILE)).subarray(0, 4);
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    throw new Error("The archive is not a zip file (missing PK header); install zip or bsdtar and rebuild.");
  }
}

async function main(): Promise<void> {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.rm(ZIP_FILE, { force: true });
  await fs.mkdir(path.join(OUT_DIR, "tools"), { recursive: true });
  await fs.mkdir(path.join(OUT_DIR, "schema"), { recursive: true });

  await bundle("scripts/visibility-aggregate.ts", path.join(OUT_DIR, "tools", "aggregate.mjs"));
  await bundle("scripts/visibility-facts.ts", path.join(OUT_DIR, "tools", "facts.mjs"));

  const brief = transformBrief(await fs.readFile("VISIBILITY_AGENT_BRIEF.md", "utf8"));
  const write = (name: string, content: string) => fs.writeFile(path.join(OUT_DIR, name), content, "utf8");
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

  await write("AGENT_BRIEF.md", brief);
  await write(
    "PROMPT.md",
    `# Prompts to attach

Fill the placeholders in angle brackets. Every prompt points back to \`AGENT_BRIEF.md\`.

## A. Agent with a shell and web access

\`\`\`text
${PROMPT_A}
\`\`\`

## B. Chat agent with browsing only (no shell)

Attach \`AGENT_BRIEF.md\` and \`submission.template.json\`. Save the JSON it returns to
\`visibility-data/runs/<TARGET_ID>/<RUN_ID>/<AGENT_ID>.json\`, then run the aggregate
command. Results from agents without the helper tools are less consistent; prefer
variant A when you can.

\`\`\`text
${PROMPT_B}
\`\`\`

## C. Discovery only

Run this on its own, then paste the entries it returns into
\`visibility-data/candidates.json\`.

\`\`\`text
${PROMPT_C}
\`\`\`
`
  );
  await write("README.md", README);
  await write("submission.template.json", json(submissionTemplate()));
  await write(
    "targets.example.json",
    json({
      policy: { scanOnlyApproved: true, doubleRatingRequired: true, maxRequestsPerTarget: 60, minDaysBetweenRuns: 7 },
      targets: [
        {
          targetId: "example-ie",
          homeUrl: "https://example.ie/",
          status: "PAUSED",
          approvalBasis: "WRITTEN_CONSENT",
          approvalRef: "Where the written consent is kept (not in this folder)",
          approvedBy: "Your name",
          approvedAt: "2026-10-03",
          sector: "professional services",
          notes: "Change status to APPROVED only once consent is on record.",
        },
      ],
    })
  );
  await write(
    "candidates.example.json",
    json({
      candidates: [
        {
          candidateId: "example-ie",
          homeUrl: "https://example.ie/",
          proposedBy: "agent-c",
          proposedAt: "2026-10-03T12:00:00Z",
          discoverySource: "Name of the directory or search page where it was listed",
          whyRelevant: "Irish professional-services firm",
          inclusionCriteria: "Public business site; Ireland; matches the target population",
          ownershipNote: "Publicly listed business; no consent yet",
          status: "PROPOSED",
        },
      ],
    })
  );
  await write("schema/submission.schema.json", json(submissionSchema()));

  const files = await walk(OUT_DIR);
  const hashes: Record<string, string> = {};
  for (const file of files) hashes[file] = await sha256(path.join(OUT_DIR, file));
  await write(
    "MANIFEST.json",
    json({
      pack: PACK_NAME,
      methodologyVersion: METHODOLOGY_VERSION,
      metrics: METHODOLOGY.metrics.length,
      categories: METHODOLOGY.categories.length,
      builtAt: new Date().toISOString(),
      files: hashes,
    })
  );

  await zip();
  const stat = await fs.stat(ZIP_FILE);
  console.log(`Built ${path.relative(process.cwd(), OUT_DIR)} (${files.length + 1} files) and ${path.relative(process.cwd(), ZIP_FILE)} (${Math.round(stat.size / 1024)} KB)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
