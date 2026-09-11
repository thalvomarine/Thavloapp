import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

declare global {
  interface Window {
    $_TSR?: {
      e?: () => void;
      h?: () => void;
    };
  }
}

/**
 * Capgo live-update handshake — fire as the very first work in the entry
 * module, before React mounts. Capgo rolls the bundle back if this never
 * resolves within `appReadyTimeout` (see capacitor.config.ts).
 */
void (async () => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();
  } catch {
    /* browser / plugin missing */
  }
})();

/**
 * Static Vercel / Capacitor `index.html` is a CSR shell (`#thalvo-root`),
 * not a server-rendered document. Hydrating that splash with
 * `hydrateRoot(document)` is React #418. Mount with `createRoot` instead.
 * Vite SSR (no `#thalvo-root`) still hydrates the full document.
 */
function isSpaShell() {
  return Boolean(document.getElementById("thalvo-root"));
}

function isNativeWebViewShell() {
  try {
    const Cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    return Boolean(Cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

const app = isNativeWebViewShell() ? (
  <StartClient />
) : (
  <StrictMode>
    <StartClient />
  </StrictMode>
);

startTransition(() => {
  const spaRoot = document.getElementById("thalvo-root");
  if (spaRoot && isSpaShell()) {
    window.$_TSR?.e?.();
    createRoot(spaRoot).render(app);
    return;
  }
  hydrateRoot(document, app);
});
