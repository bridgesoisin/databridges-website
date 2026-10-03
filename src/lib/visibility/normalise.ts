const PERCENT_ESCAPE = /%[0-9a-f]{2}/gi;

export function normaliseUrl(input: string, base?: string): string | null {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  let path = url.pathname.replace(PERCENT_ESCAPE, (m) => m.toUpperCase());
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const search = url.search.replace(PERCENT_ESCAPE, (m) => m.toUpperCase());
  return `${url.protocol}//${url.host}${path}${search}`;
}

export function siteHost(urlOrHost: string): string {
  let host = urlOrHost;
  if (urlOrHost.includes("://")) {
    try {
      host = new URL(urlOrHost).hostname;
    } catch {
      host = urlOrHost;
    }
  }
  host = host.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function sameSite(a: string, b: string): boolean {
  return siteHost(a) === siteHost(b);
}
