"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-line bg-surface p-5">
      <h1 className="display text-2xl font-bold">Something went wrong</h1>
      <p className="mt-1 text-sm text-ink-2">This page could not be built just now. It will try again on the next update.</p>
      <button type="button" onClick={reset} className="mt-3 rounded-md border border-line-strong px-3 py-1.5 text-sm">
        Try again
      </button>
    </div>
  );
}
