import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Public ops contact (mailto / partner + boatshow copy).
 * Not an authorization capability — admin access is `user_roles.admin`.
 */
export const OPS_CONTACT_EMAIL = "support@thalvo.org";

/** Platform operator identity for `/admin` route lock — not shown on public forms. */
export const SUPERADMIN_EMAIL = "ismailtolgasler@gmail.com";

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SUPERADMIN_EMAIL;
}

export async function userHasAdminRole(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

/**
 * Control Tower (`/app/admin`) — requires `user_roles.admin`.
 * Client-side email bootstrap via `ensure_superadmin` was removed.
 */
export async function ensureAdminAccess(user: Pick<User, "id" | "email">): Promise<boolean> {
  return userHasAdminRole(user.id);
}

/**
 * `/admin` stays locked to the platform operator email AND an admin role row.
 */
export async function ensureSuperadminRouteAccess(
  user: Pick<User, "id" | "email">,
): Promise<boolean> {
  if (!isSuperAdminEmail(user.email)) return false;
  return userHasAdminRole(user.id);
}
