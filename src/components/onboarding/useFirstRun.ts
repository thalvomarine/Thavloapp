import { useCallback, useEffect, useState } from "react";

const KEY = (uid: string) => `thalvo_onboarding_completed_v1:${uid}`;

/**
 * First-run detection for the THALVO onboarding flow.
 * Per-user local flag — returning users skip onboarding, new users see it once.
 * Exposes `restart()` so Profile > Settings can re-open the tour later.
 */
export function useFirstRun(userId: string | undefined) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    try {
      const done = window.localStorage.getItem(KEY(userId));
      if (!done) setOpen(true);
    } catch {
      /* ignore storage errors — treat as returning user */
    }
  }, [userId]);

  const complete = useCallback(() => {
    if (userId) {
      try { window.localStorage.setItem(KEY(userId), new Date().toISOString()); } catch { /* noop */ }
    }
    setOpen(false);
  }, [userId]);

  const restart = useCallback(() => {
    if (userId) {
      try { window.localStorage.removeItem(KEY(userId)); } catch { /* noop */ }
    }
    setOpen(true);
  }, [userId]);

  return { open, complete, restart };
}

export function restartOnboarding(userId: string) {
  try { window.localStorage.removeItem(KEY(userId)); } catch { /* noop */ }
  window.location.reload();
}
