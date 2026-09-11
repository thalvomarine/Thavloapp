import { toast } from "sonner";
import { playSonarPing } from "@/lib/sonar";

export type OpsAlertKind = "job" | "sos";

function canNotify(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

export async function requestOpsNotificationPermission(): Promise<void> {
  if (!canNotify()) return;
  if (Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    /* permission prompt is best-effort */
  }
}

export function notifyIncomingJob(input: {
  kind: OpsAlertKind;
  title: string;
  body: string;
  tag?: string;
}): void {
  playSonarPing("alert");
  try {
    navigator.vibrate?.([80, 40, 80, 40, 160]);
  } catch {
    /* haptic is optional */
  }

  toast.warning(input.title, {
    description: input.body,
    duration: 8000,
  });

  if (!canNotify() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(input.title, {
      body: input.body,
      tag: input.tag ?? input.kind,
      lang: "tr",
    });
    window.setTimeout(() => n.close(), 12_000);
  } catch {
    /* WebView / denied — toast + sonar still fired */
  }
}
