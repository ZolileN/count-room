"use client";

/** + / − / reset buttons overlaid on a map. 40px targets for thumbs. */
export function ZoomControls({ zoom, onIn, onOut, onReset, max }: { zoom: number; onIn: () => void; onOut: () => void; onReset: () => void; max: number }) {
  const btn =
    "grid size-10 place-items-center bg-surface text-lg font-semibold text-ink hover:bg-surface-2 disabled:text-ink-3 disabled:hover:bg-surface";
  return (
    <div className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-lg border border-line-strong shadow-sm" role="group" aria-label="Map zoom">
      <button type="button" className={btn} onClick={onIn} disabled={zoom >= max - 0.01} aria-label="Zoom in">
        +
      </button>
      <button type="button" className={`${btn} border-t border-line`} onClick={onOut} disabled={zoom <= 1.001} aria-label="Zoom out">
        &minus;
      </button>
      {zoom > 1.001 ? (
        <button type="button" className={`${btn} border-t border-line text-sm`} onClick={onReset} aria-label="Reset zoom">
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
