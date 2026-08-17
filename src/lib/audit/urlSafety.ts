import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF guard: this app fetches arbitrary user-supplied URLs server-side, so every
 * hostname must be resolved and checked against private/reserved ranges *before*
 * any request is made. Resolving here is not enough on its own though — the
 * caller must also *connect* to the exact address returned by resolvePublicHost
 * (see crawler.ts's pinned dispatcher) rather than letting the HTTP client
 * re-resolve DNS itself, otherwise a DNS-rebinding attacker can return a safe
 * address for this check and a private one moments later for the real
 * connection.
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

export function isPrivateIP(ip: string): boolean {
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

export type ResolvedAddress = { address: string; family: 4 | 6 };

/**
 * Resolves the hostname, throws if any resolved address is private/reserved,
 * and returns the validated addresses so the caller can pin its connection to
 * one of them instead of trusting a second, later DNS lookup.
 */
export async function resolvePublicHost(hostname: string): Promise<ResolvedAddress[]> {
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new UnsafeUrlError("Private or reserved addresses cannot be scanned.");
    }
    return [{ address: hostname, family: net.isIP(hostname) as 4 | 6 }];
  }

  let addresses: ResolvedAddress[];
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: false });
    addresses = results.map((r) => ({ address: r.address, family: r.family as 4 | 6 }));
  } catch {
    throw new UnsafeUrlError("Could not resolve that hostname.");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("Could not resolve that hostname.");
  }

  for (const { address } of addresses) {
    if (isPrivateIP(address)) {
      throw new UnsafeUrlError("That hostname resolves to a private or reserved address and cannot be scanned.");
    }
  }

  return addresses;
}
