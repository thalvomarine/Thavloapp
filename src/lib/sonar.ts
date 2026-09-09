/**
 * Cockpit "new contact" chime for the admin tower — a short synthesized
 * sonar-style ping, generated with the WebAudio API so no binary asset
 * needs to ship. Best-effort: browsers that block audio without a prior
 * user gesture simply stay silent, and any failure here must never break
 * the realtime update it accompanies.
 */
let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

export function playSonarPing(kind: "advisory" | "alert" = "advisory"): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";

    const startFreq = kind === "alert" ? 880 : 660;
    const endFreq = kind === "alert" ? 440 : 440;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.35);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "alert" ? 0.18 : 0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "alert" ? 0.6 : 0.4));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (kind === "alert" ? 0.65 : 0.45));

    if (kind === "alert") {
      // A second, higher echo reinforces the "incoming SOS" read versus the
      // single soft advisory chime.
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1100, now + 0.28);
      gain2.gain.setValueAtTime(0.0001, now + 0.28);
      gain2.gain.exponentialRampToValueAtTime(0.15, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.28);
      osc2.stop(now + 0.65);
    }
  } catch {
    // Silence is an acceptable degradation; the visual toast still lands.
  }
}
