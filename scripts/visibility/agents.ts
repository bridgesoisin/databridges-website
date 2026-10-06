// CLI orchestration is deliberately outside the network-confined scanner library.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type ProviderName = "codex" | "claude";
export type AgentRole = "discover" | "review";
export type AgentFailureCode =
  | "UNAVAILABLE" | "AUTH" | "RATE_LIMIT" | "TIMEOUT" | "INVALID_OUTPUT" | "FAILED";

/** Deliberately carries no provider text, command, payload, credentials, or cause. */
export class AgentFailure extends Error {
  constructor(public readonly code: AgentFailureCode) {
    super(code);
    this.name = "AgentFailure";
  }
}

const MAX_BYTES = 1024 * 1024;
const MAX_TIMEOUT_MS = 180_000;
const PROBE_TIMEOUT_MS = 30_000;
const TEMP_PREFIX = "visibility-agent-";

const SCHEMAS = {
  discover: {
    type: "object",
    properties: {
      candidates: {
        type: "array", maxItems: 10,
        items: {
          type: "object",
          properties: {
            homeUrl: { type: "string" },
            sourceUrl: { type: "string" },
            country: { type: "string", enum: ["IE", "OTHER", "UNKNOWN"] },
            sector: { type: "string", enum: ["professional-services", "OTHER", "UNKNOWN"] },
            companyOnly: { type: "boolean" },
          },
          required: ["homeUrl", "sourceUrl", "country", "sector", "companyOnly"],
          additionalProperties: false,
        },
      },
    },
    required: ["candidates"], additionalProperties: false,
  },
  review: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["CONFIRMED", "WITHHOLD"] },
      strengthMetricId: { type: ["string", "null"] },
      improvementMetricId: { type: ["string", "null"] },
    },
    required: ["verdict", "strengthMetricId", "improvementMetricId"],
    additionalProperties: false,
  },
} as const;

function assertSelection(provider: ProviderName, role?: AgentRole): void {
  if (!["codex", "claude"].includes(provider) ||
      (role !== undefined && !["discover", "review"].includes(role))) {
    throw new AgentFailure("UNAVAILABLE");
  }
}

/** Pure argv builder: all prompt and payload content goes through stdin. */
export function buildAgentArgs(
  provider: ProviderName,
  role: AgentRole,
  files: { schemaPath: string; outputPath: string },
): string[] {
  assertSelection(provider, role);
  if (provider === "codex") {
    return [
      "exec", "--ephemeral", "--ignore-user-config", "--sandbox", "read-only",
      "--skip-git-repo-check", "--disable", "shell_tool", "--disable", "unified_exec",
      "--disable", "multi_agent", "-c", "approval_policy='never'",
      "-c", `web_search='${role === "discover" ? "cached" : "disabled"}'`,
      "--output-schema", files.schemaPath, "-o", files.outputPath, "-",
    ];
  }
  return [
    "-p", "--output-format", "json", "--json-schema", JSON.stringify(SCHEMAS[role]),
    "--tools", role === "discover" ? "WebSearch" : "",
    "--allowedTools", role === "discover" ? "WebSearch" : "",
    "--disallowedTools", "mcp__*", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--setting-sources", "", "--no-session-persistence", "--permission-mode", "dontAsk",
    "--max-turns", "8", "--max-budget-usd", "1", "--no-chrome",
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function validateOutput(role: AgentRole, value: unknown): unknown {
  let valid = false;
  if (role === "discover" && exactKeys(value, ["candidates"])) {
    valid = Array.isArray(value.candidates) && value.candidates.length <= 10 &&
      value.candidates.every((candidate: unknown) =>
        exactKeys(candidate, ["homeUrl", "sourceUrl", "country", "sector", "companyOnly"]) &&
        typeof candidate.homeUrl === "string" && typeof candidate.sourceUrl === "string" &&
        ["IE", "OTHER", "UNKNOWN"].includes(candidate.country as string) &&
        ["professional-services", "OTHER", "UNKNOWN"].includes(candidate.sector as string) &&
        typeof candidate.companyOnly === "boolean");
  } else if (role === "review" &&
      exactKeys(value, ["verdict", "strengthMetricId", "improvementMetricId"])) {
    valid = ["CONFIRMED", "WITHHOLD"].includes(value.verdict as string) &&
      (value.strengthMetricId === null || typeof value.strengthMetricId === "string") &&
      (value.improvementMetricId === null || typeof value.improvementMetricId === "string");
  }
  if (!valid) throw new AgentFailure("INVALID_OUTPUT");
  return value;
}

function textFailure(text: string): AgentFailureCode {
  if (/rate[ _-]?limit|too many requests|\b429\b|usage[ _-]?limit|session[ _-]?limit|quota exceeded|hit your (?:usage |session |spending )?limit|limit reached/i.test(text)) return "RATE_LIMIT";
  if (/not logged in|login required|please log in|unauthenticated|authentication|invalid.{0,30}(token|credential)|\b40[13]\b/i.test(text)) return "AUTH";
  if (/invalid.{0,30}(json|schema)|structured.{0,30}output.{0,30}(invalid|failed)/i.test(text)) return "INVALID_OUTPUT";
  return "FAILED";
}

/** Codex supplies its final file; Claude supplies a JSON result envelope. */
export function parseAgentOutput(provider: ProviderName, role: AgentRole, text: string): unknown {
  assertSelection(provider, role);
  if (Buffer.byteLength(text) > MAX_BYTES) throw new AgentFailure("INVALID_OUTPUT");
  try {
    let value: unknown = JSON.parse(text);
    if (provider === "claude") {
      if (!isRecord(value)) throw new AgentFailure("INVALID_OUTPUT");
      if (value.is_error === true ||
          (typeof value.subtype === "string" && value.subtype !== "success")) {
        throw new AgentFailure(textFailure(text));
      }
      if (!Object.hasOwn(value, "structured_output")) throw new AgentFailure("INVALID_OUTPUT");
      value = value.structured_output;
    }
    return validateOutput(role, value);
  } catch (error) {
    throw error instanceof AgentFailure ? error : new AgentFailure("INVALID_OUTPUT");
  }
}

type LocatorOptions = { platform?: NodeJS.Platform; env?: Record<string, string | undefined>; homeDir?: string };

/** Never resolves a .cmd/.bat shim or invokes a shell to find an executable. */
export async function locateProviderBinary(
  provider: ProviderName, options: LocatorOptions = {},
): Promise<string> {
  assertSelection(provider);
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const paths = platform === "win32" ? path.win32 : path.posix;
  const home = options.homeDir ?? os.homedir();
  const envValue = (key: string) => Object.entries(env)
    .find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
  const name = `${provider}${platform === "win32" ? ".exe" : ""}`;
  const candidates = (envValue("PATH") ?? "").split(platform === "win32" ? ";" : ":")
    .map((entry) => entry.trim().replace(/^"(.*)"$/, "$1"))
    .filter((entry) => paths.isAbsolute(entry)).map((entry) => paths.join(entry, name));
  if (platform === "win32" && provider === "codex") {
    const base = paths.join(envValue("LOCALAPPDATA") ?? paths.join(home, "AppData", "Local"),
      "OpenAI", "Codex", "bin");
    try {
      const entries = await fs.readdir(base, { withFileTypes: true });
      const revisions = await Promise.all(entries.filter((entry) => entry.isDirectory() &&
        /^[a-zA-Z0-9_-]+$/.test(entry.name)).map(async (entry) => {
        const file = paths.join(base, entry.name, name);
        return { file, modified: (await fs.stat(file).catch(() => null))?.mtimeMs ?? 0 };
      }));
      candidates.push(...revisions.sort((a, b) => b.modified - a.modified).map(({ file }) => file));
    } catch { /* No installed revisions. PATH candidates can still work. */ }
  }
  if (provider === "claude") {
    candidates.push(paths.join(home, ".local", "bin", name));
    if (platform === "win32") {
      const roaming = envValue("APPDATA") ?? paths.join(home, "AppData", "Roaming");
      candidates.push(paths.join(roaming, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", name));
      for (const directory of (envValue("PATH") ?? "").split(";")) {
        const clean = directory.trim().replace(/^"(.*)"$/, "$1");
        if (paths.isAbsolute(clean)) candidates.push(paths.join(clean, "node_modules", "@anthropic-ai", "claude-code", "bin", name));
      }
    }
  }
  for (const candidate of new Set(candidates)) {
    try {
      const resolved = await fs.realpath(candidate);
      if (platform === "win32" && !/\.exe$/i.test(resolved)) continue;
      if (!(await fs.stat(resolved)).isFile()) continue;
      await fs.access(resolved, platform === "win32" ? constants.F_OK : constants.X_OK);
      return resolved;
    } catch { /* Try the next native executable, without exposing local paths. */ }
  }
  throw new AgentFailure("UNAVAILABLE");
}

type OwnedTemp = { root: string; directory: string };

async function verifyTemp(temp: OwnedTemp): Promise<void> {
  const resolved = path.resolve(temp.directory);
  const info = await fs.lstat(resolved);
  if (path.dirname(resolved) !== temp.root ||
      !path.basename(resolved).startsWith(TEMP_PREFIX) ||
      path.basename(resolved).length <= TEMP_PREFIX.length ||
      info.isSymbolicLink() || !info.isDirectory() ||
      await fs.realpath(resolved) !== resolved || await fs.realpath(temp.root) !== temp.root) {
    throw new AgentFailure("FAILED");
  }
}

async function inTemp<T>(operation: (temp: OwnedTemp) => Promise<T>): Promise<T> {
  let temp: OwnedTemp | undefined;
  try {
    const root = await fs.realpath(os.tmpdir());
    // Only this successful mkdtemp return establishes ownership.
    temp = { root, directory: await fs.mkdtemp(path.join(root, TEMP_PREFIX)) };
    await verifyTemp(temp);
    return await operation(temp);
  } catch (error) {
    throw error instanceof AgentFailure ? error : new AgentFailure("FAILED");
  } finally {
    if (temp) {
      try {
        await verifyTemp(temp);
        await fs.rm(temp.directory, { recursive: true, force: true });
      } catch {
        // A replaced directory is never recursively removed. Do not leak filesystem errors.
        throw new AgentFailure("FAILED");
      }
    }
  }
}

function childEnvironment(directory: string): NodeJS.ProcessEnv {
  const permitted = new Set([
    "path", "systemroot", "windir", "home", "userprofile", "homedrive", "homepath",
    "appdata", "localappdata", "codex_home", "claude_config_dir", "lang", "lc_all",
  ]);
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const [key, value] of Object.entries(process.env)) {
    if (permitted.has(key.toLowerCase())) env[key] = value;
  }
  // API keys, provider/model overrides, debug settings, NODE_OPTIONS and project
  // context are not inherited. Existing subscription credentials remain on disk.
  env.TEMP = directory;
  env.TMP = directory;
  env.TMPDIR = directory;
  return env;
}

async function killOwnTree(child: ChildProcessWithoutNullStreams, cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  const pid = child.pid;
  if (!pid || !Number.isSafeInteger(pid) || pid <= 0) return;
  if (process.platform !== "win32") {
    try { process.kill(-pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    return;
  }
  const systemRoot = Object.entries(env).find(([key]) => key.toLowerCase() === "systemroot")?.[1];
  if (!systemRoot || !path.win32.isAbsolute(systemRoot)) {
    child.kill("SIGKILL");
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const killer = spawn(path.join(systemRoot, "System32", "taskkill.exe"),
        ["/PID", String(pid), "/T", "/F"], { cwd, env, shell: false, windowsHide: true, stdio: "ignore" });
      const timer = setTimeout(() => { killer.kill("SIGKILL"); child.kill("SIGKILL"); resolve(); }, 5_000);
      killer.once("error", () => { clearTimeout(timer); child.kill("SIGKILL"); resolve(); });
      killer.once("close", (code) => { clearTimeout(timer); if (code !== 0) child.kill("SIGKILL"); resolve(); });
    } catch { child.kill("SIGKILL"); resolve(); }
  });
}

type ProcessOptions<T> = {
  cwd: string; timeoutMs: number; stdin?: string; collect?: "stdout" | "both" | "none";
  allowFailure?: boolean; decode: (text: string) => T;
};

function runProcess<T>(binary: string, args: string[], options: ProcessOptions<T>): Promise<{ value: T; exitCode: number | null }> {
  const env = childEnvironment(options.cwd);
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(binary, args, { cwd: options.cwd, env, shell: false,
        windowsHide: true, detached: process.platform !== "win32", stdio: "pipe" });
    } catch { reject(new AgentFailure("UNAVAILABLE")); return; }
    let settled = false;
    let stopping = false;
    let bytes = 0;
    let failureCode: AgentFailureCode = "FAILED";
    let tail = "";
    const buffers: Buffer[] = [];
    const clear = () => { clearTimeout(timer); buffers.forEach((buffer) => buffer.fill(0)); buffers.length = 0; tail = ""; };
    const fail = (code: AgentFailureCode) => {
      if (settled) return;
      settled = true; clear(); reject(new AgentFailure(code));
    };
    const stop = (code: AgentFailureCode) => {
      if (settled || stopping) return;
      stopping = true;
      void killOwnTree(child, options.cwd, env).then(() => fail(code), () => fail(code));
    };
    const timer = setTimeout(() => stop("TIMEOUT"), options.timeoutMs);
    const consume = (chunk: Buffer | string, stream: "stdout" | "stderr") => {
      if (settled || stopping) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_BYTES) { stop("INVALID_OUTPUT"); return; }
      tail = (tail + buffer.toString("utf8")).slice(-4096);
      const classified = textFailure(tail);
      if (classified !== "FAILED") failureCode = classified;
      if (options.collect === "both" || (stream === "stdout" && options.collect !== "none")) buffers.push(Buffer.from(buffer));
    };
    child.stdout.on("data", (chunk: Buffer) => consume(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => consume(chunk, "stderr"));
    child.once("error", (error: NodeJS.ErrnoException) => {
      if (child.pid) stop("FAILED");
      else fail(["ENOENT", "EACCES", "EPERM"].includes(error.code ?? "") ? "UNAVAILABLE" : "FAILED");
    });
    child.stdin.on("error", () => stop("FAILED"));
    child.stdout.on("error", () => stop("FAILED"));
    child.stderr.on("error", () => stop("FAILED"));
    child.once("close", (exitCode) => {
      if (settled || stopping) return;
      if (exitCode !== 0 && !options.allowFailure) { fail(failureCode); return; }
      let combined: Buffer | undefined;
      try {
        combined = Buffer.concat(buffers);
        const value = options.decode(combined.toString("utf8"));
        settled = true; clear(); resolve({ value, exitCode });
      } catch (error) {
        fail(error instanceof AgentFailure ? error.code : "INVALID_OUTPUT");
      } finally { combined?.fill(0); }
    });
    try { child.stdin.end(options.stdin ?? ""); } catch { stop("FAILED"); }
  });
}

async function readLimited(file: string): Promise<string> {
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  const buffer = Buffer.alloc(MAX_BYTES + 1);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_BYTES) throw new AgentFailure("INVALID_OUTPUT");
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_BYTES) throw new AgentFailure("INVALID_OUTPUT");
    return buffer.toString("utf8", 0, offset);
  } finally { buffer.fill(0); await handle.close(); }
}

function remaining(deadline: number, cap = MAX_TIMEOUT_MS): number {
  const left = Math.min(cap, deadline - Date.now());
  if (left <= 0) throw new AgentFailure("TIMEOUT");
  return left;
}

async function checkCapabilities(provider: ProviderName, binary: string, temp: OwnedTemp, deadline: number): Promise<void> {
  const required = provider === "codex"
    ? ["--ephemeral", "--ignore-user-config", "--sandbox", "--skip-git-repo-check", "--disable", "--output-schema", "--output-last-message"]
    : ["--print", "--output-format", "--json-schema", "--tools", "--allowedTools", "--disallowedTools",
      "--strict-mcp-config", "--mcp-config", "--setting-sources", "--no-session-persistence",
      "--permission-mode", "--max-budget-usd", "--no-chrome"];
  const help = await runProcess(binary, provider === "codex" ? ["exec", "--help"] : ["--help"], {
    cwd: temp.directory, timeoutMs: remaining(deadline, PROBE_TIMEOUT_MS),
    decode: (text) => required.every((flag) => new RegExp(`${flag}(?=[\\s,=<]|$)`).test(text)) &&
      text.includes(provider === "codex" ? "read-only" : "dontAsk"),
  });
  if (!help.value) throw new AgentFailure("UNAVAILABLE");
  if (provider === "claude") {
    // --max-turns is hidden by some native releases. A recognized root option
    // reaches subcommand help; unknown options instead print the root help.
    const probe = await runProcess(binary, ["--max-turns", "8", "auth", "status", "--help"], {
      cwd: temp.directory, timeoutMs: remaining(deadline, PROBE_TIMEOUT_MS),
      decode: (text) => /^Usage:\s+claude auth status\b/m.test(text) && /--json\b/.test(text),
    });
    if (!probe.value) throw new AgentFailure("UNAVAILABLE");
  }
}

async function checkAuthentication(provider: ProviderName, binary: string, temp: OwnedTemp, deadline: number): Promise<boolean> {
  const result = await runProcess(binary, provider === "codex" ? ["login", "status"] : ["auth", "status"], {
    cwd: temp.directory, timeoutMs: remaining(deadline, PROBE_TIMEOUT_MS),
    collect: provider === "codex" ? "both" : "stdout", allowFailure: true,
    decode: (text) => {
      if (provider === "codex") return /logged in using ChatGPT/i.test(text) && !/API[ _-]?key/i.test(text);
      try {
        const status: unknown = JSON.parse(text);
        return isRecord(status) && status.loggedIn === true &&
          !(typeof status.authMethod === "string" && /api[ _-]?key/i.test(status.authMethod));
      } catch { return false; }
    },
  });
  return result.exitCode === 0 && result.value;
}

export async function preflightProviders(): Promise<Record<ProviderName, { available: boolean; authenticated: boolean }>> {
  const check = async (provider: ProviderName) => {
    try {
      const binary = await locateProviderBinary(provider);
      return await inTemp(async (temp) => {
        const deadline = Date.now() + PROBE_TIMEOUT_MS;
        await checkCapabilities(provider, binary, temp, deadline);
        const authenticated = await checkAuthentication(provider, binary, temp, deadline).catch(() => false);
        return { available: true, authenticated };
      });
    } catch { return { available: false, authenticated: false }; }
  };
  const [codex, claude] = await Promise.all([check("codex"), check("claude")]);
  return { codex, claude };
}

export async function invokeAgent(
  provider: ProviderName, role: AgentRole, payload: unknown, options: { timeoutMs?: number } = {},
): Promise<unknown> {
  assertSelection(provider, role);
  const requested = options.timeoutMs ?? MAX_TIMEOUT_MS;
  if (!Number.isSafeInteger(requested) || requested <= 0) throw new AgentFailure("FAILED");
  const deadline = Date.now() + Math.min(requested, MAX_TIMEOUT_MS);
  try {
    // The parent reads only the selected role. The child never receives a repo path.
    const roleFile = path.resolve(process.cwd(), "docs", "visibility", "agents", `${role}.md`);
    const rolePrompt = await readLimited(roleFile).catch(() => { throw new AgentFailure("UNAVAILABLE"); });
    if (!rolePrompt.trim()) throw new AgentFailure("UNAVAILABLE");
    const stdin = JSON.stringify({ role, rolePrompt, payload });
    if (payload === undefined || Buffer.byteLength(stdin) > MAX_BYTES) throw new AgentFailure("FAILED");
    const binary = await locateProviderBinary(provider);
    return await inTemp(async (temp) => {
      await checkCapabilities(provider, binary, temp, deadline);
      if (!(await checkAuthentication(provider, binary, temp, deadline))) throw new AgentFailure("AUTH");
      const schemaPath = path.join(temp.directory, "schema.json");
      const outputPath = path.join(temp.directory, "output.json");
      if (provider === "codex") await fs.writeFile(schemaPath, JSON.stringify(SCHEMAS[role]), { flag: "wx", mode: 0o600 });
      const result = await runProcess(binary, buildAgentArgs(provider, role, { schemaPath, outputPath }), {
        cwd: temp.directory, timeoutMs: remaining(deadline), stdin,
        collect: provider === "codex" ? "none" : "stdout",
        decode: (text) => provider === "claude" ? parseAgentOutput(provider, role, text) : undefined,
      });
      if (provider === "claude") return result.value;
      try {
        const info = await fs.lstat(outputPath);
        if (info.isSymbolicLink() || !info.isFile() || await fs.realpath(outputPath) !== outputPath) {
          throw new AgentFailure("INVALID_OUTPUT");
        }
        return parseAgentOutput(provider, role, await readLimited(outputPath));
      } catch { throw new AgentFailure("INVALID_OUTPUT"); }
    });
  } catch (error) {
    throw error instanceof AgentFailure ? error : new AgentFailure("FAILED");
  }
}
