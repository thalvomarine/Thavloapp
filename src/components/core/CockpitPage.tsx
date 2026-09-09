import type { ReactNode } from "react";

interface Props {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** CockpitPage — spacing shell used inside MissionShell for feature routes. */
export function CockpitPage({ header, children, className = "" }: Props) {
  return (
    <div className={"space-y-4 " + className}>
      {header}
      {children}
    </div>
  );
}
