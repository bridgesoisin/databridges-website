import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getApprovedTarget } from "@/lib/visibility/aggregate-fs";
import { POLICY_VERSION } from "@/lib/visibility/autonomous/policy";

const owned: string[] = [];
afterEach(async () => { for (const root of owned.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
const target = { targetId: "example-ie", homeUrl: "https://example.ie/", status: "APPROVED",
  approvalBasis: "PUBLIC_SCOPE", approvalRef: POLICY_VERSION, sector: "professional-services", companyOnly: true };
async function approve(change: Record<string, unknown> = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "visibility-approved-test-")); owned.push(root);
  await fs.writeFile(path.join(root, "targets.json"), JSON.stringify({ targets: [{ ...target, ...change }] }));
  return getApprovedTarget(root, "example-ie");
}
describe("operator-approved public scope in the legacy manual tool", () => {
  it("does not require site-owner consent within explicit bounded scope", async () => {
    expect((await approve()).approvalBasis).toBe("PUBLIC_SCOPE");
  });
  it.each([{ homeUrl: "https://example.com/" }, { homeUrl: "http://127.0.0.1/" }, { homeUrl: "https://example.ie/person" },
    { approvalRef: "random approval" }, { companyOnly: false }, { sector: "other" }])
    ("does not interpret the removed consent gate as arbitrary scanning %#", async change => {
      await expect(approve(change)).rejects.toThrow("outside the approved");
    });
});
