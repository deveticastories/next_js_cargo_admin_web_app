"use client";

import { useEffect, useRef, useState } from "react";

/** Counts up from 0 to `value` on mount (and eases to new values), so dashboard tiles feel alive. */
export function AnimatedNumber({ value, format, duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = origin + (value - origin) * eased;
      from.current = current;
      setShown(current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const n = Math.round(shown);
  return <>{format ? format(n) : n.toLocaleString()}</>;
}
