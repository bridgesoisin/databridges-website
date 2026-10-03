import { classifyPageFetch } from "./context";
import { extractPageFacts } from "./extract";
import { createGuardedFetcher, type RobotsGate } from "./fetch";
import { ABOUT_PATTERN, OWN_AGENT_TOKEN } from "./lists";
import type { Resolver } from "./net-guard";
import { normaliseUrl, sameSite } from "./normalise";
import { isAllowed as robotsAllows, robotsFromRecord, type RobotsAccess } from "./robots";
import { selectSample } from "./sample";
import { parseSitemap, type ParsedSitemap } from "./sitemap-parse";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "./types";
import type {
  CandidateExclusion,
  CandidateSummary,
  FetchErrorCode,
  FetchRecord,
  FetchRequest,
  Fetcher,
  LinkCheckOutcome,
  LinkCheckPurpose,
  LinkCheckResult,
  PageFacts,
  PageType,
  RobotsRecord,
  SampledPage,
  ScanOutcome,
  ScanSnapshot,
  ScanStats,
  SitemapRecord,
  SitemapRole,
} from "./types";
import { parseTarget } from "./url";

export const MAX_REQUESTS = 60;
export const MAX_DECLARED_SITEMAPS = 3;
export const MAX_SITEMAP_CHILDREN = 3;
export const LINKS_PER_PAGE = 10;
export const LINKS_PER_JOB = 40;
export const TIMING_EXTRA_SAMPLES = 2;

const PARALLEL = 2;
const ABOUT_LINK_CAP = 5;
const LINK_SOURCES_CAP = 5;
const URL_CAP = 2048;
const DETAIL_CAP = 300;
const UNOBSERVED_LINK_STATUSES: ReadonlySet<number> = new Set([401, 403, 408, 429]);
const PURPOSE_ORDER: readonly LinkCheckPurpose[] = ["S3.06", "A4.01"];

export type OwnAgentGate = {
  // Pass as createGuardedFetcher({ robotsGate }) so redirect hops are checked against the scanner's own agent.
  readonly gate: RobotsGate;
  attach(check: ((url: string) => Promise<boolean>) | null): void;
};

export type ScanOptions = {
  now: Date;
  scannerVersion: string;
  scannerRegion?: string | null;
  ownAgentGate?: OwnAgentGate;
};

export type ScanSiteOptions = ScanOptions & {
  allowedHosts?: readonly string[];
  resolver?: Resolver;
};

type ScanFetcher = Fetcher & {
  stats?(): ScanStats;
  wasRetried?(req: FetchRequest): boolean;
  close?(): void;
};

type RobotsEntry = { origin: string; record: FetchRecord; access: RobotsAccess };

type PlannedLink = { url: string; sources: string[]; purposes: Set<LinkCheckPurpose> };

type SnapshotParts = Partial<
  Pick<
    ScanSnapshot,
    "httpsAttempt" | "sitemaps" | "llms" | "httpVariant" | "timing" | "linkChecks" | "pages" | "candidates"
  >
> & {
  inputUrl: string;
  homeUrl: string;
  outcome: ScanOutcome;
  outcomeDetail: string | null;
};

export function createOwnAgentGate(): OwnAgentGate {
  let active: ((url: string) => Promise<boolean>) | null = null;
  return {
    // Closed unless a scan is attached: a gate nobody can answer for must not let requests through.
    gate: (url) => (active === null ? false : active(url)),
    attach: (check) => {
      active = check;
    },
  };
}

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function isSuccess(status: number | null): boolean {
  return status !== null && status >= 200 && status < 300;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}\u{2026}`;
}

// HTTP requests behind one record: every redirect response, plus the final response unless that is itself the last hop.
function requestCost(record: FetchRecord): number {
  const chain = record.redirectChain;
  if (chain.length === 0) return record.requestAcceptEncoding === null && record.status === null ? 0 : 1;
  return chain[chain.length - 1].url === record.finalUrl ? chain.length : chain.length + 1;
}

function emptyCandidates(): CandidateSummary {
  const excluded = {} as Record<CandidateExclusion, number>;
  for (const key of CANDIDATE_EXCLUSIONS) excluded[key] = 0;
  const byType = {} as Record<PageType, number>;
  for (const key of PAGE_TYPES) byType[key] = 0;
  return { fromSitemap: 0, fromHomepageLinks: 0, considered: 0, excluded, byType, capped: false };
}

function isRobotsRefusal(record: FetchRecord): boolean {
  const error = record.error;
  if (error === null) return false;
  return error.code === "ROBOTS_DISALLOWED" || (error.code === "REDIRECT_BLOCKED" && error.message.startsWith("ROBOTS_DISALLOWED"));
}

function homepageUnusable(record: FetchRecord): boolean {
  if (record.status === null) return true;
  return record.error !== null && !isSuccess(record.status);
}

function describeFailure(record: FetchRecord | null): string {
  if (record === null) return "not attempted";
  if (record.error !== null) return record.error.code;
  return record.status === null ? "no response" : `HTTP ${record.status}`;
}

function linkOutcome(status: number | null, errorCode: FetchErrorCode | null, retried: boolean): LinkCheckOutcome {
  if (errorCode !== null || status === null) return "unobserved";
  if (UNOBSERVED_LINK_STATUSES.has(status)) return "unobserved";
  if (status === 404 || status === 410) return "broken";
  if (status >= 500 && status <= 599) return retried ? "broken" : "unobserved";
  return "ok";
}

function aboutPath(url: string): boolean {
  try {
    return ABOUT_PATTERN.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function factsOf(record: FetchRecord): PageFacts | null {
  if (classifyPageFetch(record) !== "ok" || record.body === null) return null;
  return extractPageFacts(record.body, { finalUrl: record.finalUrl, headers: record.headers });
}

function planLinks(pages: readonly SampledPage[], facts: readonly (PageFacts | null)[], homeUrl: string): PlannedLink[] {
  const planned = new Map<string, PlannedLink>();
  const add = (url: string, source: string, purpose: LinkCheckPurpose): void => {
    let entry = planned.get(url);
    if (entry === undefined) {
      entry = { url, sources: [], purposes: new Set() };
      planned.set(url, entry);
    }
    entry.purposes.add(purpose);
    if (entry.sources.length < LINK_SOURCES_CAP && !entry.sources.includes(source)) entry.sources.push(source);
  };
  const usable = (link: PageFacts["links"][number]): link is PageFacts["links"][number] & { url: string } =>
    link.sameSite && !link.fragmentOnly && link.url !== null && sameSite(link.url, homeUrl);

  const homeFacts = pages.length > 0 && pages[0].type === "home" ? facts[0] : null;
  if (homeFacts !== null) {
    let count = 0;
    for (const link of homeFacts.links) {
      if (count >= ABOUT_LINK_CAP) break;
      if (!usable(link) || !aboutPath(link.url) || planned.has(link.url)) continue;
      add(link.url, pages[0].url, "A4.01");
      count += 1;
    }
  }

  const chosen = new Set<string>();
  pages.forEach((page, index) => {
    const pageFacts = facts[index];
    if (pageFacts === null) return;
    const own = new Set<string>();
    for (const value of [page.url, page.record.finalUrl, page.record.url]) own.add(normaliseUrl(value) ?? value);
    const ordered = [
      ...pageFacts.links.filter((link) => link.location === "main"),
      ...pageFacts.links.filter((link) => link.location !== "main"),
    ];
    const seen = new Set<string>();
    let count = 0;
    for (const link of ordered) {
      if (count >= LINKS_PER_PAGE) break;
      if (!usable(link) || own.has(link.url) || seen.has(link.url)) continue;
      if (!chosen.has(link.url) && chosen.size >= LINKS_PER_JOB) continue;
      seen.add(link.url);
      chosen.add(link.url);
      count += 1;
      add(link.url, page.url, "S3.06");
    }
  });
  return [...planned.values()];
}

class Session {
  private readonly robots = new Map<string, Promise<RobotsEntry>>();
  private readonly durations: number[] = [];
  private used = 0;
  private capHit = false;
  private timeoutSeen = false;

  constructor(
    private readonly fetcher: ScanFetcher,
    private readonly options: ScanOptions,
    private readonly scannedAt: string,
  ) {}

  private refusal(req: FetchRequest, code: FetchErrorCode, message: string): FetchRecord {
    const url = normaliseUrl(req.url) ?? String(req.url).slice(0, URL_CAP);
    return {
      url,
      finalUrl: url,
      kind: req.kind,
      method: req.method,
      status: null,
      redirectChain: [],
      headers: {},
      contentType: null,
      wireBytes: 0,
      decodedBytes: 0,
      bodyHash: null,
      body: null,
      truncated: false,
      error: { code, message },
      requestAcceptEncoding: null,
      fetchedAt: this.scannedAt,
      durationMs: 0,
      ttfbMs: null,
      tls: null,
    };
  }

  private requestsSoFar(): number {
    const stats = this.fetcher.stats?.();
    return stats === undefined ? this.used : stats.requestCount;
  }

  private halted(): boolean {
    if (this.requestsSoFar() >= MAX_REQUESTS) return true;
    return this.timeoutSeen || this.fetcher.stats?.().jobTimedOut === true;
  }

  private async send(req: FetchRequest): Promise<FetchRecord> {
    if (this.requestsSoFar() >= MAX_REQUESTS) {
      this.capHit = true;
      return this.refusal(req, "REQUEST_CAP_REACHED", `The scan request budget of ${MAX_REQUESTS} was reached.`);
    }
    this.used += 1;
    let record: FetchRecord;
    try {
      record = await this.fetcher.fetch(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      record = this.refusal(req, "UNKNOWN", clip(`The fetcher threw: ${message}`, DETAIL_CAP));
    }
    this.used += requestCost(record) - 1;
    if (record.error?.code === "JOB_TIMEOUT") this.timeoutSeen = true;
    if (record.error?.code === "REQUEST_CAP_REACHED") this.capHit = true;
    this.durations.push(record.durationMs);
    return record;
  }

  private retried(req: FetchRequest): boolean {
    return this.fetcher.wasRetried?.(req) === true;
  }

  private ensureRobots(origin: string): Promise<RobotsEntry> {
    let entry = this.robots.get(origin);
    if (entry === undefined) {
      entry = this.send({ url: `${origin}/robots.txt`, kind: "robots", method: "GET" }).then((record) => ({
        origin,
        record,
        access: robotsFromRecord(record),
      }));
      this.robots.set(origin, entry);
    }
    return entry;
  }

  // An unreadable robots.txt does not stop the scan; S1.02 and A1.01 report it as SCAN_ERROR.
  private allows(entry: RobotsEntry, url: string): boolean {
    return entry.access.kind !== "rules" || robotsAllows(entry.access.rules, OWN_AGENT_TOKEN, url);
  }

  async ownAgentAllows(url: string): Promise<boolean> {
    const origin = originOf(url);
    if (origin === null) return false;
    return this.allows(await this.ensureRobots(origin), url);
  }

  private async gated(req: FetchRequest): Promise<FetchRecord> {
    if (!(await this.ownAgentAllows(req.url))) {
      return this.refusal(req, "ROBOTS_DISALLOWED", `robots.txt disallows ${OWN_AGENT_TOKEN} for this URL, so it was not requested.`);
    }
    return this.send(req);
  }

  private async robotsRecords(): Promise<RobotsRecord[]> {
    const settled = await Promise.allSettled([...this.robots.values()]);
    const records: RobotsRecord[] = [];
    for (const entry of settled) {
      if (entry.status === "fulfilled") records.push({ origin: entry.value.origin, record: entry.value.record });
    }
    return records;
  }

  private stats(): ScanStats {
    const own = this.fetcher.stats?.();
    if (own !== undefined) return own;
    return {
      requestCount: this.used,
      requestCapReached: this.capHit,
      jobTimedOut: this.timeoutSeen,
      jobDurationMs: this.durations.reduce((sum, ms) => sum + ms, 0),
    };
  }

  private async finish(parts: SnapshotParts): Promise<ScanSnapshot> {
    const robots = await this.robotsRecords();
    return {
      snapshotVersion: 1,
      scannerVersion: this.options.scannerVersion,
      inputUrl: parts.inputUrl,
      homeUrl: parts.homeUrl,
      scannedAt: this.scannedAt,
      outcome: parts.outcome,
      outcomeDetail: parts.outcomeDetail === null ? null : clip(parts.outcomeDetail, DETAIL_CAP),
      scannerRegion: this.options.scannerRegion ?? null,
      httpsAttempt: parts.httpsAttempt ?? null,
      robots,
      sitemaps: parts.sitemaps ?? [],
      llms: parts.llms ?? null,
      httpVariant: parts.httpVariant ?? null,
      timing: parts.timing ?? [],
      linkChecks: parts.linkChecks ?? [],
      pages: parts.pages ?? [],
      candidates: parts.candidates ?? emptyCandidates(),
      stats: this.stats(),
    };
  }

  async jobError(input: unknown, error: unknown): Promise<ScanSnapshot> {
    const raw = typeof input === "string" ? input.trim().slice(0, URL_CAP) : "";
    const parsed = parseTarget(raw);
    const url = parsed.ok ? parsed.url : raw;
    const message = error instanceof Error ? error.message : "unknown error";
    return this.finish({
      inputUrl: url,
      homeUrl: url,
      outcome: "JOB_ERROR",
      outcomeDetail: `The scan stopped on an unexpected error: ${message}`,
    });
  }

  async run(input: string): Promise<ScanSnapshot> {
    const parsed = parseTarget(input);
    if (!parsed.ok) {
      const raw = typeof input === "string" ? input.trim().slice(0, URL_CAP) : "";
      return this.finish({
        inputUrl: raw,
        homeUrl: raw,
        outcome: "JOB_ERROR",
        outcomeDetail: `The target was rejected (${parsed.reason}).`,
      });
    }
    const inputUrl = parsed.url;
    const blocked = (detail: string): Promise<ScanSnapshot> =>
      this.finish({ inputUrl, homeUrl: inputUrl, outcome: "BLOCKED_BY_ROBOTS", outcomeDetail: detail });

    const primary = `${new URL(inputUrl).origin}/`;
    const attempts = primary.startsWith("https:") ? [primary, `http:${primary.slice(6)}`] : [primary];

    let httpsAttempt: FetchRecord | null = null;
    let failedHttp: FetchRecord | null = null;
    let home: FetchRecord | null = null;
    let homeAttempt = primary;
    for (let i = 0; i < attempts.length; i += 1) {
      const url = attempts[i];
      const origin = originOf(url) as string;
      if (!this.allows(await this.ensureRobots(origin), url)) {
        return blocked(`robots.txt at ${origin} disallows ${OWN_AGENT_TOKEN} from the homepage; nothing else was requested.`);
      }
      const record = await this.send({ url, kind: "page", method: "GET" });
      if (isRobotsRefusal(record)) {
        return blocked(`A redirect from the homepage leads to a URL that robots.txt disallows for ${OWN_AGENT_TOKEN}.`);
      }
      if (!homepageUnusable(record)) {
        home = record;
        homeAttempt = url;
        break;
      }
      if (i === 0 && attempts.length > 1) httpsAttempt = record;
      else failedHttp = record;
    }

    if (home === null) {
      const failures = [httpsAttempt, failedHttp];
      const outOfBudget = failures.some((r) => r?.error?.code === "JOB_TIMEOUT" || r?.error?.code === "REQUEST_CAP_REACHED");
      const detail =
        httpsAttempt === null
          ? `The homepage could not be fetched over http (${describeFailure(failedHttp)}).`
          : `The homepage could not be fetched over https (${describeFailure(httpsAttempt)}) or http (${describeFailure(failedHttp)}).`;
      return this.finish({
        inputUrl,
        homeUrl: inputUrl,
        outcome: outOfBudget ? "JOB_ERROR" : "UNREACHABLE",
        outcomeDetail: outOfBudget ? `${detail} The scan ran out of time or requests first.` : detail,
        httpsAttempt,
        httpVariant: failedHttp,
      });
    }

    const homeUrl = home.finalUrl;
    const homeOrigin = originOf(homeUrl) ?? (originOf(homeAttempt) as string);
    if (!this.allows(await this.ensureRobots(homeOrigin), homeUrl)) {
      return blocked(`robots.txt at ${homeOrigin} disallows ${OWN_AGENT_TOKEN} from the homepage it redirects to; nothing else was requested.`);
    }

    const homePage: SampledPage = { url: homeUrl, type: "home", reason: "Homepage after redirects", depth: 0, record: home };
    const homeFacts = factsOf(home);

    const sitemap = await this.discoverSitemaps(homeOrigin, homeUrl);
    const sample = selectSample({
      homeUrl,
      sitemapLocs: sitemap.locs,
      homepageLinks: homeFacts === null ? [] : homeFacts.links.map((link) => link.url ?? link.href),
      sourcesCapped: sitemap.capped,
    });

    const sampled = await mapLimit(sample.pages, PARALLEL, async (selected): Promise<SampledPage> => {
      const record = await this.gated({ url: selected.url, kind: "page", method: "GET" });
      const finalOrigin = originOf(record.finalUrl);
      if (finalOrigin !== null) await this.ensureRobots(finalOrigin);
      return { url: selected.url, type: selected.type, reason: selected.reason, depth: selected.depth, record };
    });
    const pages = [homePage, ...sampled];

    const llms = this.halted() ? null : await this.gated({ url: `${homeOrigin}/llms.txt`, kind: "llms", method: "GET" });

    let httpVariant: FetchRecord | null = null;
    if (httpsAttempt === null && !this.halted()) {
      httpVariant = await this.gated({ url: `http://${new URL(homeUrl).hostname}/`, kind: "http-variant", method: "GET" });
    }

    const timing: FetchRecord[] = [];
    if (isSuccess(home.status) && home.error === null) {
      for (let i = 0; i < TIMING_EXTRA_SAMPLES && !this.halted(); i += 1) {
        timing.push(await this.gated({ url: homeUrl, kind: "timing", method: "GET" }));
      }
    }

    const linkChecks = await this.checkLinks(pages, homeFacts, homeUrl);

    return this.finish({
      inputUrl,
      homeUrl,
      outcome: "COMPLETED",
      outcomeDetail: null,
      httpsAttempt,
      sitemaps: sitemap.records,
      llms,
      httpVariant,
      timing,
      linkChecks,
      pages,
      candidates: sample.candidates,
    });
  }

  private async discoverSitemaps(
    homeOrigin: string,
    homeUrl: string,
  ): Promise<{ records: SitemapRecord[]; locs: string[]; capped: boolean }> {
    const records: SitemapRecord[] = [];
    const locs: string[] = [];
    let capped = false;

    const homeRobots = await this.ensureRobots(homeOrigin);
    const declared = homeRobots.access.kind === "rules" ? homeRobots.access.rules.sitemaps : [];
    const tops: { url: string; role: SitemapRole }[] = [];
    if (declared.length > 0) {
      const seen = new Set<string>();
      for (const raw of declared) {
        const url = normaliseUrl(raw);
        if (url === null || seen.has(url) || !sameSite(url, homeUrl)) continue;
        seen.add(url);
        tops.push({ url, role: "declared" });
        if (tops.length >= MAX_DECLARED_SITEMAPS) break;
      }
    } else {
      tops.push({ url: `${homeOrigin}/sitemap.xml`, role: "default" });
    }

    const read = (record: FetchRecord): ParsedSitemap | null =>
      isSuccess(record.status) && record.body !== null ? parseSitemap(record.body) : null;
    const take = (parsed: ParsedSitemap, record: FetchRecord): void => {
      locs.push(...parsed.locs);
      if (parsed.truncated || record.truncated) capped = true;
    };

    for (const top of tops) {
      if (this.halted()) break;
      const record = await this.gated({ url: top.url, kind: "sitemap", method: "GET" });
      records.push({ url: record.url, role: top.role, parentUrl: null, record });
      const parsed = read(record);
      if (parsed === null) continue;
      if (parsed.kind === "urlset") {
        take(parsed, record);
        continue;
      }
      if (parsed.kind !== "sitemapindex") continue;
      if (parsed.truncated || record.truncated) capped = true;
      const children: string[] = [];
      for (const raw of parsed.locs) {
        const child = normaliseUrl(raw);
        if (child === null || children.includes(child) || !sameSite(child, homeUrl)) continue;
        children.push(child);
        if (children.length >= MAX_SITEMAP_CHILDREN) break;
      }
      for (const child of children) {
        if (this.halted()) break;
        const childRecord = await this.gated({ url: child, kind: "sitemap", method: "GET" });
        records.push({ url: childRecord.url, role: "index-child", parentUrl: record.url, record: childRecord });
        const childParsed = read(childRecord);
        if (childParsed !== null && childParsed.kind === "urlset") take(childParsed, childRecord);
      }
    }
    return { records, locs, capped };
  }

  private async checkLinks(
    pages: readonly SampledPage[],
    homeFacts: PageFacts | null,
    homeUrl: string,
  ): Promise<LinkCheckResult[]> {
    const facts = pages.map((page, index) => (index === 0 ? homeFacts : factsOf(page.record)));
    const planned = planLinks(pages, facts, homeUrl);

    const byUrl = new Map<string, SampledPage>();
    for (const page of pages) {
      for (const value of [page.url, page.record.finalUrl, page.record.url]) {
        const key = normaliseUrl(value) ?? value;
        if (!byUrl.has(key)) byUrl.set(key, page);
      }
    }

    const results = await mapLimit(planned, PARALLEL, async (target): Promise<LinkCheckResult | null> => {
      const purposes = PURPOSE_ORDER.filter((purpose) => target.purposes.has(purpose));
      const existing = byUrl.get(target.url);
      if (existing !== undefined) {
        if (!target.purposes.has("S3.06")) return null;
        const req: FetchRequest = { url: existing.record.url, kind: "page", method: "GET" };
        const retried = this.retried(req);
        const errorCode = existing.record.error?.code ?? null;
        return {
          url: target.url,
          sourceUrls: target.sources,
          purposes,
          method: "GET",
          status: existing.record.status,
          errorCode,
          outcome: linkOutcome(existing.record.status, errorCode, retried),
          retried,
        };
      }
      if (this.halted()) return null;
      let req: FetchRequest = { url: target.url, kind: "link-check", method: "HEAD" };
      let record = await this.gated(req);
      if (record.status === 405 || record.status === 501) {
        req = { ...req, method: "GET" };
        record = await this.gated(req);
      }
      const retried = this.retried(req);
      const errorCode = record.error?.code ?? null;
      return {
        url: target.url,
        sourceUrls: target.sources,
        purposes,
        method: req.method,
        status: record.status,
        errorCode,
        outcome: linkOutcome(record.status, errorCode, retried),
        retried,
      };
    });
    return results.filter((result): result is LinkCheckResult => result !== null);
  }

  close(): void {
    this.fetcher.close?.();
  }
}

// One fetcher per scan: its deadline and request budget start when it is created, and it is closed here.
export async function runScan(input: string, fetcher: Fetcher, options: ScanOptions): Promise<ScanSnapshot> {
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime())) {
    throw new RangeError("runScan: options.now must be a valid Date");
  }
  const session = new Session(fetcher as ScanFetcher, options, options.now.toISOString());
  options.ownAgentGate?.attach((url) => session.ownAgentAllows(url));
  try {
    return await session.run(input);
  } catch (error) {
    return await session.jobError(input, error);
  } finally {
    options.ownAgentGate?.attach(null);
    session.close();
  }
}

export async function scanSite(input: string, options: ScanSiteOptions): Promise<ScanSnapshot> {
  const gate = options.ownAgentGate ?? createOwnAgentGate();
  const fetcher = createGuardedFetcher({
    allowedHosts: options.allowedHosts,
    resolver: options.resolver,
    robotsGate: gate.gate,
  });
  return runScan(input, fetcher, { ...options, ownAgentGate: gate });
}
