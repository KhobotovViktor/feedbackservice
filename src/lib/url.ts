/**
 * Resolve the publicly visible origin of this app, suitable for building
 * redirects, short links, and survey URLs sent to outside parties.
 *
 * Priority:
 *  1) NEXT_PUBLIC_APP_URL — set in .env.production, baked into the build.
 *     This is the canonical public URL.
 *  2) Host header from the request, with default ports (:80, :443) stripped
 *     so an nginx upstream that passes "Host $host:443" doesn't leak the
 *     port into our outgoing URLs.
 *
 * Note: req.nextUrl.origin is unreliable behind nginx — it reflects the
 * internal HOSTNAME/PORT the Node process was started with (commonly
 * https://localhost:3000), not the public URL the user actually reached.
 */
export function getAppOrigin(req: { headers: Headers }): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && !fromEnv.includes("localhost")) {
    return fromEnv.replace(/\/$/, "");
  }
  const host = (req.headers.get("host") || "").replace(/:(?:80|443)$/, "");
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
