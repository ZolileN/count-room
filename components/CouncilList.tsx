"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CouncilStatus } from "@/lib/iec/types";
import { partyColour } from "@/lib/parties";
import { StatusBadge } from "./StatusBadge";

export interface CouncilRow {
  id: number;
  code: string;
  name: string;
  kind: "metro" | "local";
  provinceId: number;
  province: string;
  status: CouncilStatus;
  drawn: boolean;
  totalSeats: number;
  vdsPct: number;
  leader: { id: number; short: string } | null;
  leaderSeats: number;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any status" },
  { value: "hung", label: "Hung" },
  { value: "majority", label: "Majority" },
  { value: "counting", label: "Still counting" },
];

export function CouncilList({ councils, provinces }: { councils: CouncilRow[]; provinces: { id: number; name: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlQ = params.get("q") ?? "";
  // Typing updates local state at once; the URL follows (so filters are shareable).
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);
  const prov = params.get("province") ?? "";
  const status = params.get("status") ?? "";
  const party = params.get("party") ?? "";
  const kind = params.get("kind") ?? "";

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const leaders = useMemo(() => {
    const m = new Map<number, { id: number; short: string; n: number }>();
    for (const c of councils) {
      if (!c.leader) continue;
      const e = m.get(c.leader.id) ?? { ...c.leader, n: 0 };
      e.n++;
      m.set(c.leader.id, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [councils]);

  const needle = q.trim().toLowerCase();
  const shown = councils.filter(
    (c) =>
      (!needle || c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle)) &&
      (!prov || String(c.provinceId) === prov) &&
      (!status || c.status === status) &&
      (!party || String(c.leader?.id) === party) &&
      (!kind || c.kind === kind),
  );

  const select = "min-h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink";
  return (
    <div>
      <form role="search" className="grid grid-cols-2 gap-2 sm:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
        <label className="col-span-2 sm:col-span-1">
          <span className="sr-only">Search councils</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              set("q", e.target.value);
            }}
            placeholder="Search name or code"
            className={`${select} w-full px-3`}
          />
        </label>
        <label>
          <span className="sr-only">Province</span>
          <select value={prov} onChange={(e) => set("province", e.target.value)} className={`${select} w-full`}>
            <option value="">All provinces</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select value={status} onChange={(e) => set("status", e.target.value)} className={`${select} w-full`}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Largest party</span>
          <select value={party} onChange={(e) => set("party", e.target.value)} className={`${select} w-full`}>
            <option value="">Any largest party</option>
            {leaders.map((l) => (
              <option key={l.id} value={l.id}>{l.short} ({l.n})</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Council type</span>
          <select value={kind} onChange={(e) => set("kind", e.target.value)} className={`${select} w-full`}>
            <option value="">Metros and locals</option>
            <option value="metro">Metros only</option>
            <option value="local">Local councils only</option>
          </select>
        </label>
      </form>

      <p className="mt-3 text-sm text-ink-2" aria-live="polite">
        Showing {shown.length} of {councils.length} councils
      </p>

      <CouncilRows councils={shown} />
    </div>
  );
}

/** The list itself, without hooks: also rendered on the server as the no-JS / loading view. */
export function CouncilRows({ councils }: { councils: CouncilRow[] }) {
  return (
    <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
      {councils.map((c) => (
        <li key={c.id}>
          <Link href={`/councils/${c.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="block text-xs text-ink-3">
                {c.code} · {c.province} · {c.totalSeats} seats
              </span>
            </span>
            <span className="flex flex-col items-end gap-1 text-right">
              <StatusBadge status={c.status} drawn={c.drawn} />
              <span className="text-xs text-ink-2">
                {c.leader ? (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: partyColour(c.leader.id) }} />
                    {c.leader.short}
                    {c.status === "counting" ? " leads on votes" : ` ${c.leaderSeats}/${c.totalSeats}`}
                  </span>
                ) : null}
                {c.status === "counting" ? <span className="tally"> · {Math.round(c.vdsPct)}% in</span> : null}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
