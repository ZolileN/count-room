"use client";

import { useEffect, useState } from "react";
import type { MapGeometry } from "@/lib/geo";

const cache = new Map<string, Promise<MapGeometry>>();

/** Fetch map geometry once per URL (browser- and CDN-cached); null until it arrives. */
export function useGeometry(url: string | null): { geometry: MapGeometry | null; failed: boolean } {
  const [geometry, setGeometry] = useState<MapGeometry | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    let p = cache.get(url);
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MapGeometry>;
      });
      cache.set(url, p);
      p.catch(() => cache.delete(url));
    }
    p.then(
      (g) => alive && setGeometry(g),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return { geometry, failed };
}
