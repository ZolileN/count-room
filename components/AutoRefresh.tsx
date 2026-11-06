"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const INTERVAL_MS = 60_000;

/**
 * Re-renders the current page from the server every 60 s (server data is itself cached for 60 s,
 * so this never makes us hit the IEC faster). Pauses while the tab is hidden and catches up as soon
 * as it is visible again.
 */
export function AutoRefresh() {
  const router = useRouter();
  const last = useRef(Date.now());
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      last.current = Date.now();
      router.refresh();
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(tick, INTERVAL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        setPaused(true);
      } else {
        setPaused(false);
        if (Date.now() - last.current >= INTERVAL_MS) tick();
        start();
      }
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-3" aria-live="polite">
      <span aria-hidden className={`inline-block size-1.5 rounded-full ${paused ? "bg-line-strong" : "bg-ink-2"}`} />
      {paused ? "Updates paused" : "Updates every minute"}
    </span>
  );
}
