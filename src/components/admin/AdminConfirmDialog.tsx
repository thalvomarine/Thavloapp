import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface AdminActionRequest {
  /** Already-localised title naming the person or listing affected. */
  title: string;
  /** Already-localised body stating the consequence of the action. */
  body: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<void>;
}

interface Props {
  action: AdminActionRequest | null;
  pending: boolean;
  /** Real server error text — never swallowed, never replaced by a toast. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Single confirmation surface for every mutating Control Tower action.
 * The dialog stays open while the write is in flight and, on failure,
 * shows the actual error instead of closing with a success message.
 */
export function AdminConfirmDialog({ action, pending, error, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{action?.title}</AlertDialogTitle>
          <AlertDialogDescription>{action?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">{t("admin.actions.failed")}</span> {error}
            </span>
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("admin.actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={action?.danger ? "bg-rose-500/90 hover:bg-rose-500 text-white" : undefined}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
          >
            {pending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
            {action?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
