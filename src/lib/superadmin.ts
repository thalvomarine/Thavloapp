import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Hard-coded platform operator. Also bootstrapped into `user_roles.admin`. */
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

async function bootstrapSuperadminRole(): Promise<void> {
  const { error } = await supabase.rpc("ensure_superadmin");
  if (error) console.warn("[superadmin] ensure_superadmin", error.message);
}

/**
 * Grants `user_roles.admin` when the JWT email is the platform operator,
 * then returns whether this session may open Control Tower (`/app/admin`).
 */
export async function ensureAdminAccess(user: Pick<User, "id" | "email">): Promise<boolean> {
  if (isSuperAdminEmail(user.email)) {
    await bootstrapSuperadminRole();
    return true;
  }
  return userHasAdminRole(user.id);
}

/** `/admin` is locked to the platform operator email only. */
export async function ensureSuperadminRouteAccess(
  user: Pick<User, "id" | "email">,
): Promise<boolean> {
  if (!isSuperAdminEmail(user.email)) return false;
  await bootstrapSuperadminRole();
  return true;
}
