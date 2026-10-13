import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  as?: "div" | "section" | "aside";
  padded?: boolean;
}

/**
 * MarineOS reusable glass surface. Use for every panel/card on dark cockpit.
 * Day theme forces an opaque paper surface via `.thalvo-surface` in styles.css.
 */
export function GlassPanel({ children, className = "", padded = true, as: _as = "div", ...rest }: Props) {
  const Cmp = _as as "div";
  return (
    <Cmp
      {...rest}
      className={
        "thalvo-surface glass-panel rounded-2xl " +
        (padded ? "p-4 " : "") +
        className
      }
    >
      {children}
    </Cmp>
  );
}
