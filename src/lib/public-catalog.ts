import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PartCardData } from "@/components/marketplace/PartCard";

/**
 * Shared read layer for the anon-readable catalogue surfaces (`/`, `/marketplace`,
 * `/services`). One implementation, three call sites — no duplicated queries.
 * Relies on the existing `parts_read_anon` / `packages_read_anon` policies.
 */

export interface PartRow {
  id: string;
  name: string;
  brand: string;
  category: string;
  sku: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  compatibility: string[] | null;
  marina: string | null;
}

export interface PackageRow {
  id: string;
  key: string;
  title_tr: string;
  title_en: string;
  category: string;
  base_duration_min: number | null;
}

export async function fetchPublicParts(opts: {
  limit: number;
  dealerOnly?: boolean;
}): Promise<PartRow[]> {
  // Reads the public-safe view: exposes only non-sensitive columns (no supplier_id)
  // and only active dealer-listed parts. Anonymous access to the raw table is revoked.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  let q = client.from("public_parts_catalog").select("id, name, brand, category, sku, image_url, price, stock, compatibility, marina");
  void opts.dealerOnly; // the view only contains dealer-listed parts
  const { data, error } = await q.order("created_at", { ascending: false }).limit(opts.limit);
  if (error) {
    console.warn("[catalog] public_parts_catalog unavailable", error.message);
    return [];
  }
  return (data as PartRow[] | null) ?? [];
}

export async function fetchPublicPackages(opts: { limit?: number } = {}): Promise<PackageRow[]> {
  let q = supabase
    .from("service_packages")
    .select("id, key, title_tr, title_en, category, base_duration_min")
    .order("category");
  if (opts.limit != null) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    console.warn("[catalog] service_packages unavailable", error.message);
    return [];
  }
  return (data as PackageRow[] | null) ?? [];
}

/** Maps a catalogue row to the presentation shape used by PartCard. */
export function toPartCardData(r: PartRow, categoryLabel: (raw: string) => string): PartCardData {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    categoryLabel: categoryLabel(r.category),
    sku: r.sku,
    imageUrl: r.image_url,
    price: r.price,
    stock: r.stock,
    compatibility: r.compatibility,
    marina: r.marina,
  };
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  reload: () => void;
}

/** Minimal load/error/retry state machine for the public read surfaces. */
export function usePublicData<T>(load: () => Promise<T>): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => {
    setData(null);
    setError(null);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return { data, error, reload };
}
