import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

/** EmptyState — calm placeholder used in feeds/queues/tables. */
export function EmptyState({ icon, title, body, action, className = "" }: Props) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center text-center gap-2 py-8 px-4 " + className
      }
    >
      {icon && (
        <div className="size-10 grid place-items-center rounded-2xl bg-white/5 border border-white/10 text-white/60">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-semibold text-white">{title}</p>
      {body && <p className="text-[11px] text-white/50 max-w-xs">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
