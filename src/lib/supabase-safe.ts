import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Missing-relation / schema-cache failures from a fresh Supabase project
 * that has not yet received migrations. PostgREST surfaces these as 404
 * (`PGRST205`) rather than throwing, but some call sites still treat any
 * error as fatal and unmount the cockpit.
 */
export function isMissingRelation(error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined): boolean {
  if (!error) return false;
  const blob = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    blob.includes("does not exist") ||
    blob.includes("schema cache") ||
    blob.includes("could not find the table") ||
    /\b404\b/.test(blob)
  );
}

/** Return `data` or `[]` — never throw, never return null. */
export function rowsOrEmpty<T>(
  data: T[] | null | undefined,
  error?: PostgrestError | { message?: string; code?: string } | null,
): T[] {
  if (error) {
    console.warn("[supabase] query failed — using empty list", error.code ?? "", error.message ?? error);
    return [];
  }
  return data ?? [];
}
