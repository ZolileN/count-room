"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share the current page. Uses the phone's share sheet where available; otherwise offers copy link,
 * WhatsApp, X and Facebook. No third-party scripts: the links are plain share URLs.
 */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(window.location.href.split("#")[0] ?? "");
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const message = text ?? title;
  const onShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text: message, url });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    setOpen((o) => !o);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const enc = encodeURIComponent;
  const item = "block w-full px-3 py-2 text-left text-sm hover:bg-surface-2";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onShare}
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm font-medium"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 10V2M5 5l3-3 3 3M3 9v4h10V9" />
        </svg>
        Share
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <button type="button" role="menuitem" onClick={copy} className={item}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          <a role="menuitem" className={item} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${enc(`${message} ${url}`)}`}>
            WhatsApp
          </a>
          <a role="menuitem" className={item} target="_blank" rel="noopener noreferrer" href={`https://x.com/intent/post?text=${enc(message)}&url=${enc(url)}`}>
            X
          </a>
          <a role="menuitem" className={item} target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}>
            Facebook
          </a>
        </div>
      ) : null}
    </div>
  );
}
