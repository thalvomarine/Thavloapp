/**
 * Optional service-worker hook. The SW itself is not generated in the
 * standalone Vite build (vite-plugin-pwa deadlocked Nitro), so this is a
 * safe no-op. HTTP cache still covers last-loaded JS/CSS.
 */
export async function registerPwa(): Promise<void> {
  return;
}
