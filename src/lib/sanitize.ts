/** Shared plaintext sanitizer for captain-facing forms (notes, profile, listings).
 *  React already HTML-escapes render; this strips control chars / markup before persist. */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAGS = /<\/?[a-zA-Z][^>]*>/g;
const JS_URL = /javascript:/gi;
const EVENT_HANDLER = /\bon\w+\s*=/gi;

function stripUnsafe(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, "")
    .replace(HTML_TAGS, "")
    .replace(JS_URL, "")
    .replace(EVENT_HANDLER, "");
}

export function sanitizePlainText(raw: unknown, max = 2000): string {
  if (typeof raw !== "string") return "";
  return stripUnsafe(raw).replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitizeMultiline(raw: unknown, max = 2000): string {
  if (typeof raw !== "string") return "";
  return stripUnsafe(raw)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function sanitizePhone(raw: unknown, max = 20): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[^\d+]/g, "").slice(0, max);
}
