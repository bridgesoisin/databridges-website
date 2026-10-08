import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OWN_AGENT_TOKEN, OWN_USER_AGENT } from "@/lib/visibility/lists";

describe("DataBridgesBot information page", () => {
  it("exists at the address the scanner's User-Agent links to", () => {
    const match = /\(\+(https:\/\/databridges\.ie(\/[^)]*))\)/.exec(OWN_USER_AGENT);
    expect(match).not.toBeNull();
    const route = match![2];
    expect(existsSync(path.join(process.cwd(), "src", "app", ...route.split("/").filter(Boolean), "page.tsx"))).toBe(true);
  });

  it("names the same product token that robots.txt rules use", () => {
    expect(OWN_USER_AGENT.startsWith(`${OWN_AGENT_TOKEN}/`)).toBe(true);
  });
});
