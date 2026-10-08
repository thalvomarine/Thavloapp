import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Server-verified auth user, or null.
 *
 * `getSession()` only reads the local token cache and will happily return an
 * expired / revoked session. Using that to `redirect({ to: "/app" })` then
 * failing `getUser()` on `/_authenticated` bounces the router
 * `/` → `/app` → `/auth` → `/app` until TanStack surfaces the
 * "Rota dışına çıktık" error boundary.
 *
 * If a local session exists but the JWT is no longer valid, it is dropped
 * from storage so subsequent `getSession()` calls stay empty.
 */
const USER_TTL_MS = 90_000;
let verified: { user: User; at: number } | null = null;

export async function getValidUser(): Promise<User | null> {
  try {
    const { data: local } = await supabase.auth.getSession();
    if (!local.session) {
      verified = null;
      return null;
    }
    if (
      verified &&
      verified.user.id === local.session.user.id &&
      Date.now() - verified.at < USER_TTL_MS
    ) {
      return verified.user;
    }

    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      verified = { user: data.user, at: Date.now() };
      return data.user;
    }

    verified = null;
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Network / storage failure — do not treat as a valid login.
  }
  return null;
}
