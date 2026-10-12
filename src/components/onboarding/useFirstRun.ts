import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = (uid: string) => `thalvo_onboarding_completed_v1:${uid}`;
/** Survives Capacitor WebView / localStorage wipes — written into auth user_metadata. */
const META_KEY = "onboarding_completed_v1";
/** Accounts older than this without a flag are treated as already onboarded (one-time migration). */
const LEGACY_ACCOUNT_MS = 60 * 60 * 1000;

function readLocal(uid: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY(uid));
  } catch {
    return null;
  }
}

function writeLocal(uid: string, stamp: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY(uid), stamp);
  } catch {
    /* private mode / quota */
  }
}

function clearLocal(uid: string): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY(uid));
  } catch {
    /* ignore */
  }
}

async function readMetaComplete(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const raw = data.user.user_metadata?.[META_KEY];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

async function writeMetaComplete(stamp: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { [META_KEY]: stamp } });
  if (error) console.warn("[onboarding] metadata persist failed", error.message);
}

async function clearMetaComplete(): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { [META_KEY]: null } });
  if (error) console.warn("[onboarding] metadata clear failed", error.message);
}

async function persistComplete(userId: string): Promise<string> {
  const stamp = new Date().toISOString();
  writeLocal(userId, stamp);
  await writeMetaComplete(stamp);
  return stamp;
}

/**
 * First-run welcome tour — once per account, not every login.
 * Prefers auth user_metadata (durable), mirrors to localStorage for fast checks.
 * Profile → Replay still clears both and re-opens the tour.
 */
export function useFirstRun(userId: string | undefined) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) {
      setOpen(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      let stamp = readLocal(userId);
      if (stamp) {
        if (!cancelled) setOpen(false);
        // Heal metadata if local already said done (e.g. older clients).
        void writeMetaComplete(stamp);
        return;
      }

      stamp = await readMetaComplete();
      if (stamp) {
        writeLocal(userId, stamp);
        if (!cancelled) setOpen(false);
        return;
      }

      // Returning accounts that never got a durable flag (localStorage wiped
      // between logins) — do not force the tour again after the first hour.
      const { data } = await supabase.auth.getUser();
      const createdAt = data.user?.created_at;
      if (createdAt) {
        const age = Date.now() - new Date(createdAt).getTime();
        if (age > LEGACY_ACCOUNT_MS) {
          await persistComplete(userId);
          if (!cancelled) setOpen(false);
          return;
        }
      }

      if (!cancelled) setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const complete = useCallback(() => {
    setOpen(false);
    if (userId) void persistComplete(userId);
  }, [userId]);

  const restart = useCallback(() => {
    if (userId) {
      clearLocal(userId);
      void clearMetaComplete();
    }
    setOpen(true);
  }, [userId]);

  return { open, complete, restart };
}

export function restartOnboarding(userId: string) {
  clearLocal(userId);
  void (async () => {
    await clearMetaComplete();
    window.location.reload();
  })();
}
