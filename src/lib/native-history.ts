import { createHashHistory, type RouterHistory } from "@tanstack/react-router";

/**
 * Capacitor / Cordova / file:// WebViews boot at `/index.html`, which is not
 * a TanStack file route. Hash history keeps the document URL stable
 * (`capacitor://localhost/index.html#/app`) so the router never 404s on
 * startup. Browser / PWA builds keep the default history API.
 *
 * Android uses `https://localhost/index.html`, so protocol checks alone are
 * not enough — `Capacitor.isNativePlatform()` covers that without treating
 * `http://127.0.0.1:8080/index.html` (Vite) as native.
 */
export function isNativeWebView(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol } = window.location;
  if (protocol === "capacitor:" || protocol === "ionic:" || protocol === "file:") return true;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

export function createNativeRouterHistory(): RouterHistory | undefined {
  if (!isNativeWebView()) return undefined;
  return createHashHistory();
}
