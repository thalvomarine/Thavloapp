/**
 * Navigation guards.
 *
 * `sanitizeNext` is the single trust boundary for post-auth redirects: only a
 * same-origin relative path is ever accepted, so an attacker cannot smuggle an
 * absolute or protocol-relative URL through the `next` search param.
 */
const BLOCKED_NEXT = new Set(["/auth", "/index.html", "/index.htm"]);

export function sanitizeNext(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return undefined;
  const path = raw.split("?")[0]?.split("#")[0] ?? raw;
  if (BLOCKED_NEXT.has(path) || path.endsWith(".html") || path.endsWith(".htm")) return undefined;
  return raw;
}
