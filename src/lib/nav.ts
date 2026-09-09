/**
 * Navigation guards.
 *
 * `sanitizeNext` is the single trust boundary for post-auth redirects: only a
 * same-origin relative path is ever accepted, so an attacker cannot smuggle an
 * absolute or protocol-relative URL through the `next` search param.
 */
export function sanitizeNext(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return undefined;
  return raw;
}
