import { promises as fs } from "node:fs";
import { extractPageFacts } from "@/lib/visibility/extract";
import { declaredSitemaps, explainRobots, parseRobots } from "@/lib/visibility/robots";
import { selectSample } from "@/lib/visibility/sample";
import { parseSitemap } from "@/lib/visibility/sitemap-parse";

const USAGE = `Visibility Index facts helper (offline: it reads files you have already downloaded)

  page <html-file> <final-url> [--headers <curl-headers-file>]
        print the extracted facts for one page as JSON
  robots <robots-file|-> <url> <agent> [<agent> ...]
        print whether each agent may fetch the URL under RFC 9309 matching ("-" means no robots.txt, so allowed)
  sitemap <xml-file>
        print the kind, <loc> list and <lastmod> list
  sample <home-url> <sitemap-xml-file|-> <home-html-file>
        print the deterministic page sample (plan section 4.2.3)
`;

function parseHeaderDump(text: string): Record<string, string> {
  const blocks = text.split(/\r?\n\r?\n/).filter((b) => /^HTTP\//i.test(b.trim()));
  const last = blocks.at(-1) ?? "";
  const headers: Record<string, string> = {};
  for (const lineText of last.split(/\r?\n/).slice(1)) {
    const i = lineText.indexOf(":");
    if (i <= 0) continue;
    const name = lineText.slice(0, i).trim().toLowerCase();
    const value = lineText.slice(i + 1).trim();
    headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
  }
  return headers;
}

async function read(file: string): Promise<string> {
  return fs.readFile(file, "utf8");
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "page" && rest.length >= 2) {
    const [htmlFile, finalUrl] = rest;
    const headersIndex = rest.indexOf("--headers");
    const headers = headersIndex >= 0 ? parseHeaderDump(await read(rest[headersIndex + 1])) : {};
    console.log(JSON.stringify(extractPageFacts(await read(htmlFile), { finalUrl, headers }), null, 2));
    return 0;
  }

  if (command === "robots" && rest.length >= 3) {
    const [file, url, ...agents] = rest;
    const rules = parseRobots(file === "-" ? "" : await read(file));
    const out = agents.map((agent) => {
      const decision = explainRobots(rules, agent, url);
      return { agent, allowed: decision.allowed, rule: decision.rule };
    });
    console.log(JSON.stringify({ url, sitemaps: declaredSitemaps(rules), decisions: out }, null, 2));
    return 0;
  }

  if (command === "sitemap" && rest.length === 1) {
    console.log(JSON.stringify(parseSitemap(await read(rest[0])), null, 2));
    return 0;
  }

  if (command === "sample" && rest.length === 3) {
    const [homeUrl, sitemapFile, homeHtml] = rest;
    const sitemapLocs = sitemapFile === "-" ? [] : parseSitemap(await read(sitemapFile)).locs;
    const facts = extractPageFacts(await read(homeHtml), { finalUrl: homeUrl, headers: {} });
    const homepageLinks = facts.links.map((link) => link.url).filter((u): u is string => typeof u === "string");
    console.log(JSON.stringify(selectSample({ homeUrl, sitemapLocs, homepageLinks }), null, 2));
    return 0;
  }

  console.log(USAGE);
  return command ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
);
