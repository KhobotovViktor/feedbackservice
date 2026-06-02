/**
 * Bitrix24 incoming-webhook URL validators.
 *
 * Centralized here so the rule lives in one place; previously the same
 * isSafeB24Url body was copy-pasted into four route handlers (b24/webhook,
 * settings, surveys, test-b24-notification) and was drifting between them.
 *
 * What "safe" means:
 *   - https:// only (never http)
 *   - host must end in a `bitrix24.*` segment (catches localized portals
 *     like *.bitrix24.ru, *.bitrix24.com, *.bitrix24.by, *.bitrix24.kz)
 *   - never a loopback, link-local, or RFC1918 private range — these are
 *     the classic SSRF pivots through metadata services, internal admin
 *     panels, and cloud provider control planes
 */

export function isSafeB24Url(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    host === "0.0.0.0" ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return false;
  }

  // "bitrix24" must be the registrable domain: <portal>.bitrix24.<tld>.
  // A bare host.includes("bitrix24.") check was unsafe — it accepted
  // attacker domains like "bitrix24.fake.com.attacker.io" (bitrix24 is
  // just the leftmost label there). Require it to be the second-to-last
  // label so only genuine *.bitrix24.<tld> portals pass.
  const labels = host.split(".");
  return labels.length >= 2 && labels[labels.length - 2] === "bitrix24";
}

/**
 * Normalize the URL admins paste from Bitrix24's "Incoming webhook" UI.
 * Bitrix sometimes shows the URL with a trailing slash and a sample method
 * (`profile.json`); we keep just the base so callers can append methods
 * like `crm.deal.get.json` cleanly.
 */
export function normalizeB24Url(url: string): string {
  return url
    .trim()
    .replace(/\/$/, "")
    .replace(/\/(profile\.json|profile)$/, "");
}
