import { promises as fs } from "node:fs";
import {
  DEFAULT_ROOT,
  aggregateTarget,
  initRoot,
  listRunTargets,
  rebuildIndex,
  writeSkeleton,
} from "@/lib/visibility/aggregate-fs";
import { scoreSubmission, validateSubmission } from "@/lib/visibility/aggregate";
import { displayScore } from "@/lib/visibility/scoring";

const USAGE = `Visibility Index aggregator

  --init                              create reports/visibility/ and the starter targets.json
  --skeleton --target <id> --run <runId> --agent <agentId>
                                      create a blank submission with all 52 metrics (APPROVED targets only)
  --validate <file>                   check one submission file and show its score
  --target <id> --run <runId>         aggregate every agent submission for one target and run
  --all --run <runId>                 aggregate every target that has submissions for the run
  --index                             rebuild index.csv from scores/
  --root <dir>                        folder to use (default ${DEFAULT_ROOT})
`;

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function line(value: number | null): string {
  const shown = displayScore(value);
  return shown === null ? "withheld" : String(shown);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const root = arg(args, "--root") ?? DEFAULT_ROOT;

  if (args.length === 0 || args.includes("--help")) {
    console.log(USAGE);
    return args.length === 0 ? 1 : 0;
  }

  if (args.includes("--init")) {
    const created = await initRoot(root);
    console.log(created.length > 0 ? `Created in ${root}: ${created.join(", ")}` : `${root} is already set up.`);
    return 0;
  }

  if (args.includes("--skeleton")) {
    const target = arg(args, "--target");
    const run = arg(args, "--run");
    const agent = arg(args, "--agent");
    if (!target || !run || !agent) {
      console.error("--skeleton needs --target, --run and --agent.");
      return 1;
    }
    console.log(`Created ${await writeSkeleton(root, target, run, agent)}`);
    return 0;
  }

  const file = arg(args, "--validate");
  if (file) {
    const result = validateSubmission(JSON.parse(await fs.readFile(file, "utf8")));
    if (!result.ok) {
      console.error(`INVALID (${result.errors.length} problem${result.errors.length === 1 ? "" : "s"}):`);
      for (const e of result.errors) console.error(`  - ${e}`);
      return 1;
    }
    const scored = scoreSubmission(result.submission);
    console.log(
      `OK  overall ${line(scored.summary.overall)}  SEO ${line(scored.summary.seo)}  AEO ${line(scored.summary.aeo)}  coverage ${scored.summary.coverage}`
    );
    return 0;
  }

  if (args.includes("--index")) {
    console.log(`Indexed ${await rebuildIndex(root)} target(s) into ${root}/index.csv`);
    return 0;
  }

  const runId = arg(args, "--run");
  const target = arg(args, "--target");
  if (runId && (target || args.includes("--all"))) {
    const targets = target ? [target] : await listRunTargets(root, runId);
    if (targets.length === 0) {
      console.error(`No submissions found for run ${runId}.`);
      return 1;
    }
    let status = 0;
    for (const id of targets) {
      const { report, invalid } = await aggregateTarget(root, id, runId);
      for (const bad of invalid) {
        status = 1;
        console.error(`${id}/${bad.file} is invalid:`);
        for (const e of bad.errors) console.error(`  - ${e}`);
      }
      if (!report) {
        status = 1;
        console.error(`${id}: no valid submission for run ${runId}.`);
        continue;
      }
      console.log(
        `${id}: overall ${line(report.summary.overall)}  SEO ${line(report.summary.seo)}  AEO ${line(report.summary.aeo)}  ` +
          `coverage ${report.summary.coverage}  raters ${report.raters}  confidence ${report.confidence}` +
          (report.disputes.length > 0 ? `  disputes ${report.disputes.map((d) => d.metricId).join(",")}` : "")
      );
    }
    return status;
  }

  console.log(USAGE);
  return 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
);
