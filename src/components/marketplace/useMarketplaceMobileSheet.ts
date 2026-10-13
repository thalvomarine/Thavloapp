import { useEffect, useState } from "react";
import { isNativeWebView } from "@/lib/native-history";

/** Narrow / native → bottom sheet; wide web → docked left rail. */
export function useMarketplaceMobileSheet(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    if (isNativeWebView()) return true;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  useEffect(() => {
    if (isNativeWebView()) {
      setMobile(true);
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}
