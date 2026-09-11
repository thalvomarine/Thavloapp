import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Compile-time fallbacks from `.env` so Capacitor WebViews still boot when
 * `import.meta.env` is empty. These are the public URL + anon (publishable)
 * key only — never a service_role secret.
 */
const FALLBACK_SUPABASE_URL = "https://vofjektddsxmavghlerj.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmpla3RkZHN4bWF2Z2hsZXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxODkzNzksImV4cCI6MjA5ODc2NTM3OX0.YVMBWb19pxpz1VlIkGjHSzeP2wrAOGjvcbcLzbpQxyA";

function stripEnv(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== "undefined" && (import.meta as ImportMeta).env) {
      const value = (import.meta as ImportMeta).env[key as keyof ImportMetaEnv];
      const stripped = stripEnv(value);
      if (stripped) return stripped;
    }
  } catch {
    /* import.meta unavailable */
  }
  try {
    if (typeof process !== "undefined" && process.env?.[key]) {
      return stripEnv(process.env[key]);
    }
  } catch {
    /* process.env unavailable in the WebView */
  }
  return "";
};

const SUPABASE_URL =
  stripEnv(import.meta.env.VITE_SUPABASE_URL) ||
  getEnv("VITE_SUPABASE_URL") ||
  getEnv("SUPABASE_URL") ||
  FALLBACK_SUPABASE_URL;

const SUPABASE_KEY =
  stripEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  stripEnv(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  getEnv("VITE_SUPABASE_ANON_KEY") ||
  getEnv("SUPABASE_PUBLISHABLE_KEY") ||
  getEnv("SUPABASE_ANON_KEY") ||
  FALLBACK_SUPABASE_ANON_KEY;

function projectRefFromUrl(url: string): string {
  try {
    return new URL(url).hostname.split(".")[0] || "thalvo";
  } catch {
    return "thalvo";
  }
}

function dropStaleAuthStorage(currentRef: string) {
  if (typeof window === "undefined") return;
  try {
    const keep = `sb-${currentRef}-`;
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key === "supabase.auth.token") remove.push(key);
      if (key.startsWith("sb-") && !key.startsWith(keep)) remove.push(key);
    }
    for (const key of remove) window.localStorage.removeItem(key);
  } catch {
    /* private mode / WebView storage blocked */
  }
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient(): SupabaseClient<Database> {
  const url = SUPABASE_URL;
  let key = SUPABASE_KEY;

  if (!import.meta.env.VITE_SUPABASE_URL || !(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)) {
    console.warn("[Supabase] Vite env empty — using bundled public URL/anon key fallback.");
  }

  if (key.startsWith("sb_secret_") || key.includes("service_role")) {
    console.warn("[Supabase] Service-role key ignored in the browser client — using anon fallback.");
    key = FALLBACK_SUPABASE_ANON_KEY;
  }

  const ref = projectRefFromUrl(url);
  dropStaleAuthStorage(ref);

  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
    },
    auth: {
      storage: typeof window === "undefined" ? undefined : localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: `sb-${ref}-auth-token`,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: SupabaseClient<Database> | undefined;

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
