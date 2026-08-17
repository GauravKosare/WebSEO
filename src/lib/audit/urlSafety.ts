import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF guard: this app fetches arbitrary user-supplied URLs server-side, so every
 * hostname must be resolved and checked against private/reserved ranges *before*
 * any request is made, and again on every redirect hop (DNS can change between
 * check and fetch, and redirects can point anywhere).
 */

export class UnsafeUrlError extends Error {}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0 && parts[2] === 2) return true; // documentation
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === "::1") return true; // loopback
  if (norm === "::") return true;
  if (norm.startsWith("fe80:") || norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) return true; // link-local
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // unique local
  if (norm.startsWith("::ffff:")) {
    // IPv4-mapped IPv6
    const v4 = norm.split(":").pop();
    if (v4 && v4.includes(".")) return isPrivateIPv4(v4);
    return true;
  }
  return false;
}

function isPrivateIP(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // unknown format, fail closed
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function parseAndValidateUrlShape(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError("Only http:// and https:// URLs are supported.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not supported.");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new UnsafeUrlError("Local addresses cannot be scanned.");
  }
  return url;
}

/** Resolves the hostname and throws if any resolved address is private/reserved. */
export async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new UnsafeUrlError("Private or reserved addresses cannot be scanned.");
    }
    return;
  }

  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: false });
    addresses = results.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError("Could not resolve that hostname.");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("Could not resolve that hostname.");
  }

  for (const addr of addresses) {
    if (isPrivateIP(addr)) {
      throw new UnsafeUrlError("That hostname resolves to a private or reserved address and cannot be scanned.");
    }
  }
}

export async function validateExternalUrl(rawUrl: string): Promise<URL> {
  const url = parseAndValidateUrlShape(rawUrl);
  await assertPublicHost(url.hostname);
  return url;
}
