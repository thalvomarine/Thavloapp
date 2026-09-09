import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  full_name: string;
  boat_name: string | null;
  role: "Client" | "Provider" | "Supplier";
  wallet_balance: number;
  preferred_language: "tr" | "en";
  phone: string | null;
  account_type: string | null;
  profile_picture_url: string | null;
  emergency_health_note: string | null;
  company_name: string | null;
  base_location: string | null;
  equipment: string[];
  is_available: boolean;
  business_name: string | null;
  home_marina: string | null;
  home_lat: number | null;
  home_lng: number | null;
}

export function useSessionUser() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Persistent session: getSession() reads from localStorage synchronously-ish.
    // Do NOT force loading=false via a timeout — that races refresh and drops the user.
    void Promise.resolve(supabase.auth.getSession())
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null as User | null, loading };
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!userId) { setProfile(null); setLoading(false); setError(null); return; }
    let mounted = true;
    setLoading(true);
    setError(null);
    // NOTE: no timeout fallback and no synthesized profile — we never invent a
    // role (previously defaulted to "Client"), which caused Provider users to
    // render as Captain when the fetch was slow.
    void Promise.resolve(supabase.from("profiles").select("*").eq("id", userId).maybeSingle())
      .then(({ data, error: err }) => {
        if (!mounted) return;
        if (err) {
          setProfile(null);
          setError(new Error(err.message));
        } else {
          setProfile((data as unknown as Profile | null) ?? null);
          setError(null);
        }
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setProfile(null);
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    const channelId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(`profile:${userId}:${channelId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => setProfile(payload.new as unknown as Profile))
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [userId]);
  // `timedOut` retained for backward-compat with callers; always false now.
  return { profile, loading, timedOut: false, error };
}


export const n = useProfile;
