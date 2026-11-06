"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type View = [number, number, number, number]; // x, y, width, height (viewBox units)

export const MAX_ZOOM = 12;

/** Parse "x y w h". */
export function parseViewBox(vb: string): View {
  const [x = 0, y = 0, w = 1, h = 1] = vb.split(/[\s,]+/).map(Number);
  return [x, y, w, h];
}

/** Zoom `view` by `factor` (>1 = in) about point (px, py), clamped to [1, MAX_ZOOM] of `base`. Pure. */
export function zoomAbout(view: View, base: View, factor: number, px: number, py: number): View {
  const [x, y, w, h] = view;
  const minW = base[2] / MAX_ZOOM;
  const nw = Math.min(base[2], Math.max(minW, w / factor));
  const f = w / nw;
  const nh = h / f;
  return clampView([px - (px - x) / f, py - (py - y) / f, nw, nh], base);
}

/** Keep the view inside the base area (no panning off into empty space). Pure. */
export function clampView(view: View, base: View): View {
  const [x, y, w, h] = view;
  const [bx, by, bw, bh] = base;
  const cw = Math.min(w, bw);
  const ch = Math.min(h, bh);
  return [Math.min(Math.max(x, bx), bx + bw - cw), Math.min(Math.max(y, by), by + bh - ch), cw, ch];
}

/**
 * Pan and zoom an SVG by changing its viewBox (so text and strokes stay crisp).
 *
 * Touch: pinch to zoom; one-finger drag pans once zoomed in. At normal size one-finger swipes are
 * left to the browser so the page still scrolls. Mouse: drag to pan, double-click to zoom in,
 * Ctrl/Cmd + wheel (and trackpad pinch) to zoom; a plain wheel still scrolls the page.
 *
 * Double-tap vs tap: a tap on a shape (open a council, select a ward) waits briefly to see whether
 * a second tap follows; if one does, the map zooms instead.
 */
export const DOUBLE_TAP_MS = 260;
export function usePanZoom(containerRef: RefObject<HTMLElement | null>, baseViewBox: string | null) {
  const base = baseViewBox ? parseViewBox(baseViewBox) : null;
  const baseKey = baseViewBox ?? "";
  const [view, setView] = useState<View | null>(base);
  const viewRef = useRef<View | null>(view);
  viewRef.current = view;

  // Reset when the underlying map (or province crop) changes.
  useEffect(() => {
    setView(baseViewBox ? parseViewBox(baseViewBox) : null);
  }, [baseViewBox]);

  const toSvg = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const svg = containerRef.current?.querySelector("svg");
      const v = viewRef.current;
      if (!svg || !v) return null;
      const r = svg.getBoundingClientRect();
      const s = Math.min(r.width / v[2], r.height / v[3]);
      const ox = (r.width - v[2] * s) / 2;
      const oy = (r.height - v[3] * s) / 2;
      return [v[0] + (clientX - r.left - ox) / s, v[1] + (clientY - r.top - oy) / s];
    },
    [containerRef],
  );

  const unitsPerPx = useCallback((): number => {
    const svg = containerRef.current?.querySelector("svg");
    const v = viewRef.current;
    if (!svg || !v) return 1;
    const r = svg.getBoundingClientRect();
    return 1 / Math.min(r.width / v[2], r.height / v[3]);
  }, [containerRef]);

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const v = viewRef.current;
      if (!v || !base) return;
      const p = clientX !== undefined && clientY !== undefined ? toSvg(clientX, clientY) : null;
      const [px, py] = p ?? [v[0] + v[2] / 2, v[1] + v[3] / 2];
      setView(zoomAbout(v, base, factor, px, py));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey, toSvg],
  );

  // Gesture state lives in refs: no re-render per pointer event except the view itself.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const suppressClick = useRef(false);
  const pinch = useRef<{ d: number; mx: number; my: number } | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<View | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowNextClick = useRef(false);

  const schedule = useCallback((v: View) => {
    pending.current = v;
    viewRef.current = v;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pending.current) setView(pending.current);
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !base) return;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved.current = 0;
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      }
    };

    const onMove = (e: PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, cur);
      const v = viewRef.current;
      if (!v) return;

      if (pointers.current.size >= 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const upp = unitsPerPx();
        // Pan with the midpoint, then zoom about it.
        const panned = clampView([v[0] - (mx - pinch.current.mx) * upp, v[1] - (my - pinch.current.my) * upp, v[2], v[3]], base);
        viewRef.current = panned;
        const p = toSvg(mx, my);
        const next = p && pinch.current.d > 0 ? zoomAbout(panned, base, d / pinch.current.d, p[0], p[1]) : panned;
        pinch.current = { d, mx, my };
        moved.current += 10;
        e.preventDefault();
        schedule(next);
        return;
      }

      const zoomed = v[2] < base[2] * 0.999;
      // At normal size, touch drags belong to the page (it scrolls); only mouse drags are ignored too.
      if (!zoomed) return;
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      moved.current += Math.abs(dx) + Math.abs(dy);
      if (moved.current < 4) return;
      const upp = unitsPerPx();
      e.preventDefault();
      schedule(clampView([v[0] - dx * upp, v[1] - dy * upp, v[2], v[3]], base));
    };

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (moved.current > 6) {
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 50);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain wheel scrolls the page
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };

    const onClickCapture = (e: MouseEvent) => {
      // A deferred single tap being replayed: let it through to the link / ward handler.
      if (allowNextClick.current) {
        allowNextClick.current = false;
        return;
      }
      // A drag that ends over a council must not open it.
      if (suppressClick.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const target = e.target as Element | null;
      // Only taps on the map itself are deferred; buttons (including their icons) act at once.
      if (!target || target.closest("button") || !target.closest('svg[role="group"]')) return;
      e.preventDefault();
      e.stopPropagation();
      if (tapTimer.current) {
        // Second tap: zoom in here instead.
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
        zoomAt(2, e.clientX, e.clientY);
        return;
      }
      const { clientX, clientY } = e;
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        allowNextClick.current = true;
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX, clientY, view: window }));
      }, DOUBLE_TAP_MS);
    };
    const onDbl = (e: MouseEvent) => e.preventDefault(); // handled by the tap logic above

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDbl);
      el.removeEventListener("click", onClickCapture, true);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, baseKey, schedule, toSvg, unitsPerPx, zoomAt]);

  const zoom = view && base ? base[2] / view[2] : 1;
  return {
    viewBox: view ? view.join(" ") : (baseViewBox ?? undefined),
    view,
    zoom,
    zoomIn: () => zoomAt(1.6),
    zoomOut: () => zoomAt(1 / 1.6),
    reset: () => base && setView(base),
    /** CSS touch-action for the map: page scrolls at normal size; the map owns gestures when zoomed. */
    touchAction: zoom > 1.001 ? "none" : "pan-y",
  };
}
