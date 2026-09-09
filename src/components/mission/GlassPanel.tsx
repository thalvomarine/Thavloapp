import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  as?: "div" | "section" | "aside";
  padded?: boolean;
}

/** MarineOS reusable glass surface. Use for every panel/card on dark cockpit. */
export function GlassPanel({ children, className = "", padded = true, as: _as = "div", ...rest }: Props) {
  const Cmp = _as as "div";
  return (
    <Cmp
      {...rest}
      className={
        "glass-panel rounded-2xl " +
        (padded ? "p-4 " : "") +
        className
      }
    >
      {children}
    </Cmp>
  );
}
