/**
 * Pages the chief-engineer assistant is allowed to open.
 * Anything outside this list is rejected on the server and again in the UI.
 */
export const PLATFORM_ROUTES = [
  { path: "/app", label: "Live chart and cockpit" },
  { path: "/app/marketplace", label: "Marketplace" },
  { path: "/app/shop", label: "Spare parts shop" },
  { path: "/app/services", label: "Maintenance services" },
  { path: "/app/orders", label: "Orders and escrow" },
  { path: "/app/passport", label: "Vessel passport" },
  { path: "/app/profile", label: "Account profile" },
  { path: "/app/report", label: "Support and problem report" },
  { path: "/app/supplier", label: "Supplier desk" },
  { path: "/app/dealer", label: "Dealer desk" },
  { path: "/app/reputation", label: "Reputation" },
  { path: "/marketplace", label: "Public parts catalog" },
  { path: "/services", label: "Public services" },
] as const;

export type AppPath = (typeof PLATFORM_ROUTES)[number]["path"];

const ALLOWED = new Set<string>(PLATFORM_ROUTES.map((route) => route.path));

/** Spoken aliases the model may use. They resolve to a real page. */
const ALIASES: Record<string, AppPath> = {
  "/escrow": "/app/orders",
  "/support": "/app/report",
  "/help": "/app/report",
  "/parts": "/app/shop",
  "/shop": "/app/shop",
  "/weather": "/app",
  "/map": "/app",
  "/passport": "/app/passport",
  "/orders": "/app/orders",
  "/profile": "/app/profile",
  "/services/book": "/app/services",
};

export function resolvePlatformRoute(raw: string): AppPath | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  const pathOnly = (trimmed.split("?")[0] ?? trimmed).split("#")[0] ?? trimmed;
  if (pathOnly.includes("\\") || pathOnly.includes("..")) return null;
  const normalized = pathOnly.length > 1 && pathOnly.endsWith("/") ? pathOnly.slice(0, -1) : pathOnly;
  const resolved = ALIASES[normalized] ?? normalized;
  if (!ALLOWED.has(resolved)) return null;
  return resolved as AppPath;
}

export function platformRouteCatalog(): string {
  const lines = PLATFORM_ROUTES.map((route) => `- ${route.path}: ${route.label}`);
  lines.push("- /escrow: alias of /app/orders");
  lines.push("- /support: alias of /app/report");
  return lines.join("\n");
}
