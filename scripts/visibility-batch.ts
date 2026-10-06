import { promises as fs } from "node:fs";
import path from "node:path";
import { preflightProviders } from "./visibility/agents";
import { counts, runBatch } from "./visibility/batch";
import { acquireLock, defaultRoot, loadDatabase, saveDatabase, unlockStale } from "@/lib/visibility/autonomous/store";

const HELP = `Visibility Index autonomous PRIVATE batch

npm run visibility:batch -- --check          Check both CLI installations/sign-ins
npm run visibility:batch -- --run            Discover, scan, review; resume automatically
npm run visibility:batch -- --status         Show progress without running agents
npm run visibility:batch -- --stop           Ask a running batch to stop safely
npm run visibility:batch -- --clear-stop     Remove the stop request before resuming
npm run visibility:batch -- --unlock-stale   Remove a lock ONLY if its process is dead
npm run visibility:batch -- --init           Initialise without network requests

Optional --target-count N (1–50) on first initialisation. Default: 50.
Uses existing Codex/Claude sign-ins and their plan allowances; no paid API fallback.
Writes only git-ignored reports/visibility/autonomous/. Nothing is published.
`;

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) { process.stdout.write(HELP); return; }
  const actions = ["--check", "--run", "--status", "--stop", "--clear-stop", "--unlock-stale", "--init"];
  const action = args.filter(a => actions.includes(a));
  const countIndex = args.indexOf("--target-count");
  const count = countIndex < 0 ? undefined : Number(args[countIndex + 1]);
  if (action.length !== 1 || args.filter(a => a === "--target-count").length > 1 ||
    args.some((a, i) => !actions.includes(a) && a !== "--target-count" && !(countIndex >= 0 && i === countIndex + 1))) throw new Error("INVALID_ARGUMENTS; use --help");
  const root = defaultRoot();
  if (action[0] === "--check") {
    process.stdout.write(`${JSON.stringify(await preflightProviders(), null, 2)}\n`); return;
  }
  if (action[0] === "--stop") { await fs.mkdir(root, { recursive: true }); await fs.writeFile(path.join(root, "STOP"), "stop\n"); process.stdout.write("Stop requested. The current bounded call may finish first.\n"); return; }
  if (action[0] === "--clear-stop") { await fs.rm(path.join(root, "STOP"), { force: true }); return; }
  if (action[0] === "--unlock-stale") { await unlockStale(root); return; }
  if (action[0] === "--status") {
    const db = await loadDatabase(root, count);
    process.stdout.write(`${JSON.stringify({ state: db.state, target: db.targetCount, ...counts(db), agentCalls: db.agentCalls, retryAfter: db.retryAfter }, null, 2)}\n`); return;
  }
  const release = await acquireLock(root);
  try {
    const db = await loadDatabase(root, count);
    if (action[0] === "--init") { await saveDatabase(root, db); process.stdout.write("Private batch initialised.\n"); return; }
    const providers = await preflightProviders();
    if (!Object.values(providers).every(p => p.available && p.authenticated)) {
      db.state = "AUTH_REQUIRED"; await saveDatabase(root, db);
      process.stdout.write(`${JSON.stringify(providers, null, 2)}\nBoth CLIs must be installed and signed in. Use codex login and claude auth login, then rerun --run.\n`);
      process.exitCode = 1; return;
    }
    let interrupted = false;
    const stop = () => { interrupted = true; };
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
    const final = await runBatch(db, root, { stopped: async () => {
      if (interrupted) return true;
      try { await fs.access(path.join(root, "STOP")); return true; } catch { return false; }
    } });
    process.stdout.write(`${JSON.stringify({ state: final.state, ...counts(final), agentCalls: final.agentCalls }, null, 2)}\n`);
  } finally { await release(); }
}

main().catch(() => { process.stderr.write("Batch stopped safely. Check setup, arguments and batch.lock; use --help. Raw errors are not logged.\n"); process.exitCode = 1; });
