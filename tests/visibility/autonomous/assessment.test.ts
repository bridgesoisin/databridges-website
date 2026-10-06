import { describe, expect, it } from "vitest";
import { assess, rankEligible, reviewPayload, tipChoices, validateAssessment, validateReview } from "@/lib/visibility/autonomous/assessment";
import { runScan } from "@/lib/visibility/scan";
import { createFixtureFetcher, fixtureNames, loadFixture } from "../helpers/fixture-fetcher";
import { idealAssessment } from "../helpers/ideal-assessment";

describe("safe numeric assessment", () => {
  it.each(fixtureNames())("projects %s without changing scores or retaining raw evidence", async name => {
    const f = loadFixture(name);
    const snapshot = await runScan(f.site.inputUrl, createFixtureFetcher(f), { now: new Date(f.site.scannedAt), scannerVersion: "test" });
    const a = assess(snapshot);
    expect(a.metrics).toHaveLength(52);
    expect(validateAssessment(a)).toEqual(a);
    expect(JSON.stringify(a)).not.toContain("visibleText");
    expect(JSON.stringify(reviewPayload(a))).not.toContain(f.site.inputUrl);
  });
  it("removes unknown fields and recalculates scores from metrics on load", () => {
    const a = idealAssessment();
    const loaded = validateAssessment({ ...a, personalName: "PRIVATE_PERSON", scores: { overall: 7, email: "PRIVATE_EMAIL" } });
    expect(loaded?.scores.overall).toBe(100);
    expect(JSON.stringify(loaded)).not.toContain("PRIVATE");
  });
  it.each([NaN, -1, 26, null])("rejects invalid metric points %s", points => {
    const a = idealAssessment(); a.metrics[0].points = points;
    expect(validateAssessment(a)).toBeNull();
  });
  it("does not permit prose or a non-eligible improvement ID", () => {
    const a = idealAssessment();
    expect(validateReview({ verdict: "CONFIRMED", strengthMetricId: tipChoices(a).strengths[0], improvementMetricId: null }, a)).not.toBeNull();
    expect(validateReview({ verdict: "CONFIRMED", strengthMetricId: "PRIVATE_PERSON", improvementMetricId: null }, a)).toBeNull();
    expect(validateReview({ verdict: "CONFIRMED", strengthMetricId: null, improvementMetricId: null, text: "PRIVATE_EMAIL" }, a)).toBeNull();
  });
  it("requires BOTH reviews and adequate observation; missing data is not zero", () => {
    const a = idealAssessment();
    const review = { verdict: "CONFIRMED" as const, strengthMetricId: tipChoices(a).strengths[0], improvementMetricId: null };
    expect(rankEligible(a, { codex: review })).toBe(false);
    expect(rankEligible(a, { codex: review, claude: review })).toBe(true);
    a.scores.coverage = 0.89;
    expect(rankEligible(a, { codex: review, claude: review })).toBe(false);
  });
});
