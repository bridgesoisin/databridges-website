import { generateKeyPairSync, randomBytes, sign } from "node:crypto";

// Throwaway self-signed certificates for the local TLS test servers. Generated per test run, never written to
// disk, never trusted by anything except the test fetcher that is handed the PEM as an extra trust anchor.

const ECDSA_WITH_SHA256 = "1.2.840.10045.4.3.2";
const COMMON_NAME = "2.5.4.3";
const SUBJECT_ALT_NAME = "2.5.29.17";

function length(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, ...parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), length(body.length), body]);
}

function oid(dotted: string): Buffer {
  const arcs = dotted.split(".").map(Number);
  const out: number[] = [arcs[0] * 40 + arcs[1]];
  for (const arc of arcs.slice(2)) {
    const chunk: number[] = [arc & 0x7f];
    for (let v = arc >> 7; v > 0; v >>= 7) chunk.unshift((v & 0x7f) | 0x80);
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function time(date: Date): Buffer {
  const y = date.getUTCFullYear();
  const rest = `${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCDate(), 2)}${pad(date.getUTCHours(), 2)}${pad(date.getUTCMinutes(), 2)}${pad(date.getUTCSeconds(), 2)}Z`;
  if (y >= 1950 && y < 2050) return tlv(0x17, Buffer.from(`${pad(y % 100, 2)}${rest}`, "ascii"));
  return tlv(0x18, Buffer.from(`${pad(y, 4)}${rest}`, "ascii"));
}

function name(commonName: string): Buffer {
  return tlv(0x30, tlv(0x31, tlv(0x30, oid(COMMON_NAME), tlv(0x0c, Buffer.from(commonName, "utf8")))));
}

function pem(label: string, der: Buffer): string {
  const lines = der.toString("base64").match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

export interface CertOptions {
  commonName: string;
  dnsNames: readonly string[];
  notBefore: Date;
  notAfter: Date;
}

export interface TestCertificate {
  cert: string;
  key: string;
}

const cache = new Map<string, TestCertificate>();

export function makeCertificate(options: CertOptions): TestCertificate {
  const cacheKey = JSON.stringify([options.commonName, options.dnsNames, options.notBefore, options.notAfter]);
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const serial = randomBytes(8);
  serial[0] &= 0x7f;
  serial[0] |= 0x01;

  const algorithm = tlv(0x30, oid(ECDSA_WITH_SHA256));
  const alt = tlv(0x30, ...options.dnsNames.map((n) => tlv(0x82, Buffer.from(n, "ascii"))));
  const extensions = tlv(0xa3, tlv(0x30, tlv(0x30, oid(SUBJECT_ALT_NAME), tlv(0x04, alt))));
  const tbs = tlv(
    0x30,
    tlv(0xa0, tlv(0x02, Buffer.from([2]))),
    tlv(0x02, serial),
    algorithm,
    name(options.commonName),
    tlv(0x30, time(options.notBefore), time(options.notAfter)),
    name(options.commonName),
    spki,
    extensions,
  );
  const signature = sign("sha256", tbs, privateKey);
  const certificate = tlv(0x30, tbs, algorithm, tlv(0x03, Buffer.from([0]), signature));

  const result: TestCertificate = {
    cert: pem("CERTIFICATE", certificate),
    key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
  cache.set(cacheKey, result);
  return result;
}
