import { ScraperError } from "./errors";

/**
 * List of blocked hostnames for SSRF protection
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

/**
 * Normalize and validate URL
 * Enforces http/https, strips fragments
 */
export function normalizeUrl(input: string): URL {
  let trimmed = input.trim();

  // Reject obviously invalid protocols
  if (
    trimmed.startsWith("file:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:")
  ) {
    throw new ScraperError(
      "INVALID_URL",
      `Invalid protocol in URL: ${trimmed}`
    );
  }

  // Add https:// if no protocol
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = `https://${trimmed}`;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (err) {
    throw new ScraperError(
      "INVALID_URL",
      `Failed to parse URL: ${trimmed}`,
      err
    );
  }

  // Only allow http/https
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScraperError(
      "INVALID_URL",
      `Only http and https protocols are allowed, got: ${url.protocol}`
    );
  }

  // Strip fragment
  url.hash = "";

  return url;
}

/**
 * Check if hostname is private or localhost (SSRF protection)
 */
function isPrivateHostname(hostname: string): boolean {
  // Check exact matches
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return true;
  }

  // Check for IPv4 private ranges
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
  const ipv4Patterns = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
  ];

  for (const pattern of ipv4Patterns) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  // Check for IPv6 private ranges (simplified)
  // fc00::/7 (ULA), fe80::/10 (link-local)
  if (hostname.includes(":")) {
    const lower = hostname.toLowerCase();
    if (
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Assert that URL points to a public hostname
 * Throws ScraperError if blocked
 */
export function assertPublicHostname(url: URL): void {
  const hostname = url.hostname.toLowerCase();

  if (isPrivateHostname(hostname)) {
    throw new ScraperError(
      "BLOCKED_URL",
      `Blocked private/localhost hostname: ${hostname}`
    );
  }
}

/**
 * Check if URL is from the same origin
 */
export function isSameOrigin(url: URL, baseUrl: URL): boolean {
  return url.origin === baseUrl.origin;
}

/**
 * Resolve a relative URL against a base URL
 */
export function resolveUrl(href: string, baseUrl: URL): URL | null {
  try {
    return new URL(href, baseUrl);
  } catch {
    return null;
  }
}
