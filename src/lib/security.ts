/**
 * THALVO Security Barrier — anti-leak utilities.
 *
 * Prevents users from moving communication / payment outside the platform.
 * Pair with the DB-side `mask_job_message` trigger (already active on
 * job_messages) for defense-in-depth: the trigger is the source of truth,
 * these helpers give the client instant feedback + blocking UX.
 *
 * TODO(security-events): once a `security_events` table exists, log every
 * `high` classification here and expose it via AdminSecurityPanel.
 */

export type LeakRisk = "safe" | "low" | "medium" | "high";
export type LeakCategory =
  | "phone" | "email" | "iban" | "messaging" | "payment" | "off_platform";

export interface LeakSignal {
  category: LeakCategory;
  match: string;
  weight: number;
}

export interface LeakReport {
  risk: LeakRisk;
  signals: LeakSignal[];
  categories: LeakCategory[];
}

/* ---------- pattern tables ---------- */

const TERMS: Array<{ re: RegExp; category: LeakCategory; weight: number; label: string }> = [
  // Messaging apps
  ...termGroup(["whatsapp", "whats app", "wats?app", "wp", "watsapp"], "messaging", 3, "whatsapp"),
  ...termGroup(["telegram", "\\btg\\b"], "messaging", 3, "telegram"),
  ...termGroup(["signal app", "\\bsignal\\b"], "messaging", 2, "signal"),
  ...termGroup(["instagram", "\\big\\b", "dm me", "dm bana"], "messaging", 2, "instagram"),
  // Payment / off-platform
  ...termGroup(["iban", "banka", "bank transfer", "hesap numaras", "havale", "\\beft\\b"], "iban", 4, "iban"),
  ...termGroup(["cash", "nakit", "elden", "elden öde", "elden hallederiz", "elden alalım"], "payment", 4, "cash"),
  ...termGroup(["outside the app", "outside app", "platform dışı", "platform disi", "dışarıda", "disarida", "komisyon vermeyelim", "komisyonsuz"], "off_platform", 5, "off_platform"),
  ...termGroup(["phone number", "telefonum", "telefon numaram", "ara beni", "call me", "beni ara"], "phone", 3, "phone_intent"),
];

const PHONE_TR_RE  = /(?:\+?90 ?)?0?5\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}/g;
const PHONE_GEN_RE = /(?:\+?\d[\s\-().]?){7,}/g;
const IBAN_RE      = /\b[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}\b/gi;
const EMAIL_RE     = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function termGroup(patterns: string[], category: LeakCategory, weight: number, label: string) {
  return patterns.map((p) => ({
    re: new RegExp(`\\b${p}\\b`, "gi"),
    category, weight, label,
  }));
}

/* ---------- detection ---------- */

/** Detect leak intent in arbitrary text. Returns typed signals. */
export function detectLeakIntent(raw: string): LeakSignal[] {
  const text = (raw ?? "").toString();
  if (!text.trim()) return [];
  const signals: LeakSignal[] = [];

  for (const t of TERMS) {
    const m = text.match(t.re);
    if (m) signals.push({ category: t.category, match: m[0], weight: t.weight });
  }
  const phoneMatches = text.match(PHONE_TR_RE) ?? text.match(PHONE_GEN_RE);
  if (phoneMatches) signals.push({ category: "phone", match: phoneMatches[0], weight: 4 });
  const emailMatches = text.match(EMAIL_RE);
  if (emailMatches) signals.push({ category: "email", match: emailMatches[0], weight: 3 });
  const ibanMatches = text.match(IBAN_RE);
  if (ibanMatches) signals.push({ category: "iban", match: ibanMatches[0], weight: 5 });

  return signals;
}

/** Aggregate signals into a risk band. */
export function classifyLeakRisk(raw: string): LeakReport {
  const signals = detectLeakIntent(raw);
  const total = signals.reduce((sum, s) => sum + s.weight, 0);
  const categories = Array.from(new Set(signals.map((s) => s.category)));

  let risk: LeakRisk = "safe";
  if (total >= 7 || categories.includes("iban") || categories.includes("off_platform")) risk = "high";
  else if (total >= 4) risk = "medium";
  else if (total > 0) risk = "low";

  return { risk, signals, categories };
}

/* ---------- masking helpers ---------- */

/** Mask a phone number, keeping the last 2 digits for verification. */
export function maskPhoneNumber(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  const tail = digits.slice(-2);
  return `+•• ••• ••• •• ${tail}`;
}

/** Mask an email address, keeping first letter + domain TLD hint. */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return "—";
  const [local, domain] = value.split("@");
  if (!local || !domain) return "•••@•••";
  const domainParts = domain.split(".");
  const tld = domainParts.at(-1) ?? "";
  return `${local[0]}•••@•••.${tld}`;
}

/** Replace risky tokens in free text (contact notes, addresses).
 *  Same behaviour as the server-side `mask_job_message` trigger, minus DB IO. */
export function sanitizeContactText(raw: string): string {
  let out = raw ?? "";
  for (const t of TERMS) out = out.replace(t.re, "█████");
  out = out.replace(IBAN_RE, "██ IBAN blocked ██");
  out = out.replace(PHONE_TR_RE, "███-███-████");
  out = out.replace(PHONE_GEN_RE, "███-███-████");
  out = out.replace(EMAIL_RE, "███@███");
  return out;
}

/* ---------- copy helpers (calm, legal-safe) ---------- */

export function riskCopy(risk: LeakRisk): { title: string; body: string } {
  switch (risk) {
    case "high":
      return {
        title: "Message not sent",
        body: "For your safety, payments and communication must stay inside THALVO. Please remove contact details or off-platform payment references.",
      };
    case "medium":
      return {
        title: "Please review your message",
        body: "This looks like it may contain contact or payment details. Keep the conversation inside THALVO so escrow and dispute protection stay active.",
      };
    case "low":
      return {
        title: "Heads up",
        body: "We noticed a term that could weaken your platform protection. Consider rephrasing.",
      };
    default:
      return { title: "", body: "" };
  }
}
