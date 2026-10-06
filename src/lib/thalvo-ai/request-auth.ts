import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

function readEnv(name: string): string {
  const value = process.env[name] ?? "";
  return value.trim().replace(/^["']|["']$/g, "");
}

export interface AuthedSupabase {
  supabase: SupabaseClient<Database>;
  userId: string;
}

export function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Bearer-token auth for /api/chat. The user id always comes from the JWT,
 * never from the request body.
 */
export async function authenticateRequest(request: Request): Promise<AuthedSupabase | Response> {
  const supabaseUrl = readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
  const supabaseKey =
    readEnv("SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    console.error("[thalvo-ai] missing supabase env");
    return jsonError(500, "chat_unavailable");
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized");
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) return jsonError(401, "unauthorized");

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    global: {
      fetch: createSupabaseFetch(supabaseKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return jsonError(401, "unauthorized");
  return { supabase, userId: data.claims.sub };
}

export function isAuthed(value: AuthedSupabase | Response): value is AuthedSupabase {
  return !(value instanceof Response);
}
