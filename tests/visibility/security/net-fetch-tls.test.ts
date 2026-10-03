import { afterEach, describe, expect, it } from "vitest";
import {
  createTestFetcher,
  sendHtml,
  startHttpServer,
  startTlsServer,
  type LocalServer,
} from "../helpers/net-harness";
import { makeCertificate, type TestCertificate } from "../helpers/net-cert";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});

const DAY = 86_400_000;
const FAR_FUTURE = new Date("2100-01-01T00:00:00.000Z");
const LONG_AGO = new Date("2020-01-01T00:00:00.000Z");

async function tlsServer(cert: TestCertificate): Promise<LocalServer> {
  const server = await startTlsServer(cert, (_req, res) => sendHtml(res));
  cleanups.push(() => server.close());
  return server;
}

function fetcherFor(server: LocalServer, now: Date, ca?: string) {
  const harness = createTestFetcher({
    hosts: { "secure.example": ["127.0.0.1"] },
    ports: [server.port],
    now: () => now,
    ca,
  });
  cleanups.push(() => harness.fetcher.close());
  return harness.fetcher;
}

const secure = (server: LocalServer, path = "/") => ({ url: server.url("secure.example", path, "https"), kind: "page" as const, method: "GET" as const });

describe("TLS information", () => {
  it("records an authorised connection with the certificate expiry in whole days from the injected clock", async () => {
    const cert = makeCertificate({ commonName: "secure.example", dnsNames: ["secure.example"], notBefore: LONG_AGO, notAfter: FAR_FUTURE });
    const server = await tlsServer(cert);
    const now = new Date(FAR_FUTURE.getTime() - 30 * DAY - 6 * 3_600_000);
    const fetcher = fetcherFor(server, now, cert.cert);
    const record = await fetcher.fetch(secure(server));
    expect(record).toMatchObject({ status: 200, error: null });
    expect(record.tls).toEqual({ authorized: true, validTo: FAR_FUTURE.toISOString(), daysToExpiry: 30 });
    expect(record.fetchedAt).toBe(now.toISOString());
    expect(server.seen).toHaveLength(1);
    expect(server.seen[0].host).toBe("secure.example");
  });

  it("floors a partial day and reports a negative count once the certificate has expired", async () => {
    const cert = makeCertificate({ commonName: "secure.example", dnsNames: ["secure.example"], notBefore: LONG_AGO, notAfter: FAR_FUTURE });
    const server = await tlsServer(cert);
    const fetcher = fetcherFor(server, new Date(FAR_FUTURE.getTime() - 3 * DAY + 1_000), cert.cert);
    const record = await fetcher.fetch(secure(server));
    expect(record.tls?.daysToExpiry).toBe(2);

    const later = fetcherFor(server, new Date(FAR_FUTURE.getTime() + 2.5 * DAY), cert.cert);
    expect((await later.fetch(secure(server))).tls?.daysToExpiry).toBe(-3);
  });

  it("verifies the certificate against the original hostname, not the pinned address", async () => {
    const cert = makeCertificate({ commonName: "secure.example", dnsNames: ["secure.example"], notBefore: LONG_AGO, notAfter: FAR_FUTURE });
    const server = await tlsServer(cert);
    const fetcher = fetcherFor(server, new Date("2099-01-01T00:00:00Z"), cert.cert);
    const record = await fetcher.fetch(secure(server));
    expect(record.tls?.authorized).toBe(true);
  });

  it("records authorized=false for an untrusted certificate, retries once without verification and carries on read-only", async () => {
    const cert = makeCertificate({ commonName: "secure.example", dnsNames: ["secure.example"], notBefore: LONG_AGO, notAfter: FAR_FUTURE });
    const server = await tlsServer(cert);
    const now = new Date(FAR_FUTURE.getTime() - 10 * DAY);
    const fetcher = fetcherFor(server, now);
    const record = await fetcher.fetch(secure(server));

    expect(record.error).toBeNull();
    expect(record.status).toBe(200);
    expect(record.body).toContain("ok");
    expect(record.tls).toMatchObject({ authorized: false, error: "DEPTH_ZERO_SELF_SIGNED_CERT", validTo: FAR_FUTURE.toISOString(), daysToExpiry: 10 });
    expect(server.seen).toHaveLength(1);
    expect(server.connections()).toBe(2);
    expect(fetcher.stats().requestCount).toBe(2);
  });

  it("remembers the failure for that origin instead of failing a handshake on every request", async () => {
    const cert = makeCertificate({ commonName: "secure.example", dnsNames: ["secure.example"], notBefore: LONG_AGO, notAfter: FAR_FUTURE });
    const server = await tlsServer(cert);
    const fetcher = fetcherFor(server, new Date("2099-01-01T00:00:00Z"));
    await fetcher.fetch(secure(server, "/one"));
    const second = await fetcher.fetch(secure(server, "/two"));
    expect(second).toMatchObject({ status: 200, error: null });
    expect(second.tls).toMatchObject({ authorized: false, error: "DEPTH_ZERO_SELF_SIGNED_CERT" });
    expect(server.connections()).toBe(3);
  });

  it("records an expired certificate", async () => {
    const expired = new Date("2021-01-01T00:00:00.000Z");
    const cert = makeCertificate({ commonName: "secure.example", dnsNames: ["secure.example"], notBefore: LONG_AGO, notAfter: expired });
    const server = await tlsServer(cert);
    const fetcher = fetcherFor(server, new Date(expired.getTime() + 10 * DAY), cert.cert);
    const record = await fetcher.fetch(secure(server));
    expect(record).toMatchObject({ status: 200, error: null });
    expect(record.tls).toMatchObject({ authorized: false, error: "CERT_HAS_EXPIRED", validTo: expired.toISOString(), daysToExpiry: -10 });
  });

  it("records a certificate issued for another hostname", async () => {
    const cert = makeCertificate({ commonName: "other.example", dnsNames: ["other.example"], notBefore: LONG_AGO, notAfter: FAR_FUTURE });
    const server = await tlsServer(cert);
    const fetcher = fetcherFor(server, new Date("2099-01-01T00:00:00Z"), cert.cert);
    const record = await fetcher.fetch(secure(server));
    expect(record).toMatchObject({ status: 200, error: null });
    expect(record.tls).toMatchObject({ authorized: false, error: "ERR_TLS_CERT_ALTNAME_INVALID" });
  });

  it("still refuses to follow anything outside the allowlist after a certificate failure", async () => {
    const cert = makeCertificate({ commonName: "secure.example", dnsNames: ["secure.example"], notBefore: LONG_AGO, notAfter: FAR_FUTURE });
    const server = await startTlsServer(cert, (_req, res) => {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
      res.end();
    });
    cleanups.push(() => server.close());
    const fetcher = fetcherFor(server, new Date("2099-01-01T00:00:00Z"));
    const record = await fetcher.fetch(secure(server));
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(record.tls?.authorized).toBe(false);
  });

  it("has no TLS information for a plain http connection", async () => {
    const plain = await startHttpServer((_req, res) => sendHtml(res));
    cleanups.push(() => plain.close());
    const { fetcher } = createTestFetcher({ hosts: { "secure.example": ["127.0.0.1"] }, ports: [plain.port] });
    cleanups.push(() => fetcher.close());
    const record = await fetcher.fetch({ url: plain.url("secure.example"), kind: "page", method: "GET" });
    expect(record.tls).toBeNull();
  });

  it("reports TLS_ERROR when the server does not speak TLS at all", async () => {
    const plain = await startHttpServer((_req, res) => sendHtml(res));
    cleanups.push(() => plain.close());
    const { fetcher } = createTestFetcher({ hosts: { "secure.example": ["127.0.0.1"] }, ports: [plain.port] });
    cleanups.push(() => fetcher.close());
    const record = await fetcher.fetch({ url: plain.url("secure.example", "/", "https"), kind: "page", method: "GET" });
    expect(record.error?.code).toBe("TLS_ERROR");
    expect(plain.seen).toHaveLength(0);
  });
});
