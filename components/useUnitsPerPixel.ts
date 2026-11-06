"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * viewBox units per screen pixel for the SVG inside `ref`, kept current as it resizes, so map
 * labels can be sized in pixels at any zoom. Null until measured.
 */
export function useUnitsPerPixel(ref: RefObject<HTMLElement | null>, deps: unknown[]): number | null {
  const [upp, setUpp] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const svg = el.querySelector("svg");
      if (!svg) return;
      const vb = svg.viewBox.baseVal;
      const r = svg.getBoundingClientRect();
      if (!vb || r.width === 0 || r.height === 0) return;
      setUpp(1 / Math.min(r.width / vb.width, r.height / vb.height));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return upp;
}
