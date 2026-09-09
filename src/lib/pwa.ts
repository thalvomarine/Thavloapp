import { useEffect, useState } from "react";

/**
 * PWA install-prompt architecture.
 *
 * Captures the browser's `beforeinstallprompt` event (Chromium-family) and
 * exposes a `promptInstall()` handler. Also detects iOS Safari — where the
 * event is unavailable — so the UI can render manual instructions instead.
 *
 * TODO(push-notifications): once we ship a messaging service worker
 * (Firebase Cloud Messaging or equivalent), add a companion hook here
 * that requests Notification permission after the user opts in.
 */

// Minimal typing — the event is not in the standard lib.d.ts everywhere.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const isBrowser = typeof window !== "undefined";

export function isStandaloneDisplay(): boolean {
  if (!isBrowser) return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mm || iosStandalone);
}

export function isIos(): boolean {
  if (!isBrowser) return false;
  const ua = window.navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandaloneDisplay());
  const [iosHint, setIosHint] = useState<boolean>(false);

  useEffect(() => {
    if (!isBrowser) return;
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    setInstalled(isStandaloneDisplay());
    setIosHint(isIos() && !isStandaloneDisplay());
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferred) return "unavailable";
    try {
      await deferred.prompt();
      const res = await deferred.userChoice;
      setDeferred(null);
      return res.outcome;
    } catch {
      return "unavailable";
    }
  };

  return {
    canPrompt: !!deferred,
    installed,
    iosHint,
    promptInstall,
  };
}

/**
 * Reactive online/offline status. SSR-safe: defaults to online during render.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState<boolean>(() => (isBrowser ? window.navigator.onLine : true));
  useEffect(() => {
    if (!isBrowser) return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    setOnline(window.navigator.onLine);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}
