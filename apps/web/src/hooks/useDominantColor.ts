import { useEffect, useState } from "react";
import { getDominantColor, type RGB } from "../lib/dominantColor";

/** The dominant color of a cover (null while loading or if it can't be read). */
export function useDominantColor(src?: string, fallbacks: string[] = []): RGB | null {
  const [color, setColor] = useState<RGB | null>(null);
  const key = [src, ...fallbacks].join("|");

  useEffect(() => {
    let cancelled = false;
    setColor(null);
    if (!src) return;
    void getDominantColor([src, ...fallbacks]).then((c) => !cancelled && setColor(c));
    return () => {
      cancelled = true;
    };
    // `key` covers src + fallbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return color;
}
