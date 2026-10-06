import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { evaluateSnapshot } from "@/lib/visibility/evaluate";
import { renderMarkdown } from "@/lib/visibility/report";
import { runScan } from "@/lib/visibility/scan";
import { createFixtureFetcher, loadFixture } from "../helpers/fixture-fetcher";

it.each(["fx-minimal", "fx-spa-shell", "fx-robots-block-all", "fx-hostile"])("%s", async (name) => {
  const fixture = loadFixture(name);
  const snap = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), { now: new Date(fixture.site.scannedAt), scannerVersion: "t" });
  const report = evaluateSnapshot(snap);
  writeFileSync(`tests/visibility/_scratch-ie/${name}.md`, renderMarkdown(report));
  if (name === "fx-spa-shell") writeFileSync(`tests/visibility/_scratch-ie/${name}.json`, JSON.stringify({ ...report, metrics: undefined, scores: undefined }, null, 1));
});
