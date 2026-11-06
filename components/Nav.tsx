"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Count" },
  { href: "/map", label: "Map" },
  { href: "/projection", label: "Projection" },
  { href: "/councils", label: "Councils" },
  { href: "/metros", label: "Metros" },
  { href: "/timeline", label: "Timeline" },
  ...(process.env.NEXT_PUBLIC_AI_ENABLED === "1" ? [{ href: "/ask", label: "Ask" }] : []),
  { href: "/method", label: "Method" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="scroll-x mx-auto max-w-5xl px-2">
      <ul className="flex gap-1 whitespace-nowrap">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block border-b-2 px-2.5 py-2.5 text-sm font-medium ${
                  active ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
