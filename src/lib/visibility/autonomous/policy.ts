import { createHash } from "node:crypto";
import { parseRequestUrl } from "@/lib/visibility/url";

export const POLICY_VERSION = "public-company-ie-2026-10-04-v1";
export const COHORT = "irish-professional-services-ie-company";
export const LIMITS = Object.freeze({
  targetCount: 50,
  maxCandidates: 200,
  maxDiscoveryRounds: 20,
  maxAgentCalls: 220,
  maxHours: 12,
  maxScanAttempts: 2,
  maxReviewAttempts: 2,
  minCoverage: 0.9,
  cooldownDays: 7,
  rateLimitBackoffMs: 15 * 60_000,
});

export type Candidate = {
  id: string;
  homeUrl: string;
  sourceOrigin: string;
  discoveredBy: "codex" | "claude";
  approvalBasis: "PUBLIC_SCOPE";
  policyVersion: typeof POLICY_VERSION;
};

// Deliberately narrower than all Irish businesses: .ie corporate websites only.
// A domain is a website identifier, not a proof that no personal data exists there.
export function rootUrl(input: unknown, requireIrish = false): string | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  const parsed = parseRequestUrl(input);
  if (!parsed.ok) return null;
  const host = parsed.host;
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return null;
  if (requireIrish && (!host.endsWith(".ie") || host.split(".").length > (host.startsWith("www.") ? 3 : 2))) return null;
  const url = new URL(parsed.href);
  if (url.port || (requireIrish && (url.pathname !== "/" || url.search || url.hash))) return null;
  return `${url.origin}/`;
}

export function siteId(homeUrl: string): string {
  const host = new URL(homeUrl).hostname.replace(/^www\./, "");
  return createHash("sha256").update(host).digest("hex").slice(0, 24);
}

export function allowedHosts(homeUrl: string): string[] {
  const bare = new URL(homeUrl).hostname.replace(/^www\./, "");
  return [bare, `www.${bare}`];
}

export function admitCandidates(value: unknown, provider: Candidate["discoveredBy"]): Candidate[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { candidates?: unknown }).candidates)) return [];
  const rows = (value as { candidates: unknown[] }).candidates.slice(0, 10);
  const out = new Map<string, Candidate>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (r.country !== "IE" || r.sector !== "professional-services" || r.companyOnly !== true) continue;
    const homeUrl = rootUrl(r.homeUrl, true);
    const source = rootUrl(r.sourceUrl);
    if (!homeUrl || !source) continue;
    const id = siteId(homeUrl);
    out.set(id, { id, homeUrl, sourceOrigin: new URL(source).origin, discoveredBy: provider,
      approvalBasis: "PUBLIC_SCOPE", policyVersion: POLICY_VERSION });
  }
  return [...out.values()];
}

export function hasCompanyMarker(visibleText: string): boolean {
  // In-memory admission heuristic, not a registry lookup or a legal conclusion.
  return /\b(?:limited|ltd\.?|plc|designated activity company)\b/i.test(visibleText);
}

export const DISCOVERY_QUERIES = [
  'Irish IT consultancy limited official website site:ie',
  'Irish engineering consultancy limited official website site:ie',
  'Irish accountancy limited firm official website site:ie',
  'Irish marketing agency limited official website site:ie',
  'Irish architecture company limited official website site:ie',
  'Irish business consultancy limited official website site:ie',
  'Irish web development agency limited official website site:ie',
  'Irish environmental consultancy limited official website site:ie',
  'Irish HR consultancy limited official website site:ie',
  'Irish project management consultancy limited official website site:ie',
] as const;
