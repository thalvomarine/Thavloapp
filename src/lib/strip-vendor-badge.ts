/** Remove leftover editor/badge nodes if a host page injected them. */
const SELECTORS = [
  "#lovable-badge",
  "[id*='lovable-badge']",
  "a[href*='lovable.dev']",
  "script[src*='gpteng.co']",
  "script[src*='gptengineer']",
  "script[src*='lovable.dev']",
  "iframe[src*='gpteng']",
];

export function stripVendorBadge() {
  if (typeof document === "undefined") return;
  for (const sel of SELECTORS) {
    document.querySelectorAll(sel).forEach((el) => el.remove());
  }
}
