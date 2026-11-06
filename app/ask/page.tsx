import type { Metadata } from "next";
import Link from "next/link";
import { AskPanel } from "@/components/AskPanel";
import { aiEnabled } from "@/lib/ai/ask";
import { findCouncil, loadNational } from "@/lib/data";

export const metadata: Metadata = { title: "Ask", description: "Ask questions about the 2026 local election results, answered from the IEC figures." };

type Props = { searchParams: Promise<{ council?: string }> };

export default async function AskPage({ searchParams }: Props) {
  const { council } = await searchParams;
  const nat = await loadNational();
  const c = nat.ok && council && /^\d{1,6}$/.test(council) ? findCouncil(nat.value.data, Number(council)) : undefined;
  const enabled = aiEnabled();
  const suggestions = c
    ? [`Which combinations reach a majority in ${c.name}?`, `How has the vote changed since 2021 in ${c.name}?`, `Which wards in ${c.name} are closest?`]
    : ["How many councils are hung so far?", "What does the projection show compared with the raw count?", "Which metros are still counting?", "Which councils in KwaZulu-Natal are hung?"];

  return (
    <>
      <h1 className="display text-3xl font-bold sm:text-4xl">Ask</h1>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        Questions about the results{c ? <> in <Link href={`/councils/${c.id}`} className="underline">{c.name}</Link></> : ""}, answered by an AI (Claude) from the
        IEC figures shown on this site. It will not predict outcomes or take sides.
      </p>
      <div className="mt-5">
        {enabled ? (
          <AskPanel suggestions={suggestions} councilId={c?.id ?? null} scopeLabel={c ? c.name : "the results"} />
        ) : (
          <p className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-2">
            The AI analyst is switched off on this site. Everything it would draw on is on the{" "}
            <Link href="/" className="underline">count</Link>, <Link href="/councils" className="underline">councils</Link> and{" "}
            <Link href="/projection" className="underline">projection</Link> pages.
          </p>
        )}
      </div>
    </>
  );
}
