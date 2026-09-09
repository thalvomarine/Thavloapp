import markUrl from "@/assets/thalvo-mark-alpha.png";
import fullUrl from "@/assets/thalvo-logo-full-alpha.png";

/**
 * THALVO brand mark.
 *
 * Renders the approved artwork with a transparent background so it sits
 * directly on any surface. Small sizes use the crest only — the wordmark
 * inside the full lockup would be illegible below ~64px.
 */
export function Wordmark({
  className = "",
  size = "md",
  decorative = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Set when an adjacent visible text label already says THALVO. */
  decorative?: boolean;
}) {
  const boxCls = {
    sm: "size-9",
    md: "size-12",
    lg: "size-28",
    xl: "size-40 sm:size-48",
  }[size];

  const useFull = size === "lg" || size === "xl";
  const src = useFull ? fullUrl : markUrl;

  return (
    <span className={`inline-block ${boxCls} ${className}`}>
      <img
        src={src}
        alt={decorative ? "" : "THALVO"}
        aria-hidden={decorative || undefined}
        width={512}
        height={512}
        className="size-full object-contain"
      />
    </span>
  );
}
