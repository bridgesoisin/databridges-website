import { describe, expect, it } from "vitest";
import { admitCandidates, allowedHosts, hasCompanyMarker, rootUrl, siteId } from "@/lib/visibility/autonomous/policy";

const candidate = { homeUrl: "https://example.ie/", sourceUrl: "https://trade.example/list?person=SECRET",
  country: "IE", sector: "professional-services", companyOnly: true };

describe("bounded company admission", () => {
  it("removes source paths, queries and any unknown fields", () => {
    const found = admitCandidates({ candidates: [{ ...candidate, name: "SECRET" }] }, "codex");
    expect(found).toHaveLength(1);
    expect(found[0].sourceOrigin).toBe("https://trade.example");
    expect(JSON.stringify(found)).not.toContain("SECRET");
  });
  it.each(["http://127.0.0.1/", "https://localhost/", "https://service.local/", "https://user:password@example.ie/",
    "ftp://example.ie/", "https://example.ie:444/", "https://example.ie/person/jane", "https://sub.example.ie/", "https://example.com/"])
    ("refuses %s", url => expect(rootUrl(url, true)).toBeNull());
  it.each([{ companyOnly: false }, { country: "UNKNOWN" }, { sector: "OTHER" }])("rejects uncertain scope %j", change => {
    expect(admitCandidates({ candidates: [{ ...candidate, ...change }] }, "claude")).toEqual([]);
  });
  it("deduplicates aliases and limits results", () => {
    expect(siteId("https://www.example.ie/")).toBe(siteId("http://example.ie/"));
    expect(allowedHosts(candidate.homeUrl)).toEqual(["example.ie", "www.example.ie"]);
    expect(admitCandidates({ candidates: [candidate, candidate] }, "codex")).toHaveLength(1);
  });
  it("requires an observed corporate marker, without keeping its value", () => {
    expect(hasCompanyMarker("Example Ltd. is a consultancy")).toBe(true);
    expect(hasCompanyMarker("Unlimited opportunities; personal portfolio")).toBe(false);
  });
});
