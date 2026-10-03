import { describe, expect, it } from "vitest";
import { normaliseUrl, sameSite, siteHost } from "@/lib/visibility/normalise";

describe("normaliseUrl", () => {
  it("lowercases scheme and host, drops default port and fragment", () => {
    expect(normaliseUrl("HTTPS://Example.IE:443/About#team")).toBe(
      "https://example.ie/About"
    );
  });

  it("strips a trailing slash except at the root", () => {
    expect(normaliseUrl("https://example.ie/")).toBe("https://example.ie/");
    expect(normaliseUrl("https://example.ie/services/")).toBe(
      "https://example.ie/services"
    );
  });

  it("resolves dot segments and relative references", () => {
    expect(normaliseUrl("../a/./b", "https://example.ie/x/y/")).toBe(
      "https://example.ie/x/a/b"
    );
  });

  it("uppercases percent-encoding and keeps the query as written", () => {
    expect(normaliseUrl("https://example.ie/a%2fb?q=%e2%9c%93&z=1")).toBe(
      "https://example.ie/a%2Fb?q=%E2%9C%93&z=1"
    );
  });

  it("keeps a non-default port", () => {
    expect(normaliseUrl("http://example.ie:8080/")).toBe(
      "http://example.ie:8080/"
    );
  });

  it("returns null for invalid or non-http(s) input", () => {
    expect(normaliseUrl("mailto:a@b.ie")).toBeNull();
    expect(normaliseUrl("javascript:alert(1)")).toBeNull();
    expect(normaliseUrl("not a url")).toBeNull();
  });

  it("drops userinfo", () => {
    expect(normaliseUrl("https://user:pw@example.ie/a")).toBe(
      "https://example.ie/a"
    );
  });
});

describe("sameSite", () => {
  it("treats a leading www as equivalent", () => {
    expect(siteHost("https://www.Example.ie/x")).toBe("example.ie");
    expect(sameSite("https://www.example.ie", "http://example.ie/a")).toBe(true);
  });

  it("does not equate different hosts", () => {
    expect(sameSite("https://blog.example.ie", "https://example.ie")).toBe(false);
  });
});
