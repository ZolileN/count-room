import { partyColour } from "@/lib/parties";

export function Swatch({ id, className = "size-2.5" }: { id: number; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-[3px] ${className}`} style={{ background: partyColour(id) }} />;
}

/** Swatch + short code. Identity is always carried by the text, not the colour. */
export function PartyLabel({ id, short, title, className = "" }: { id: number; short: string; title?: string; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`} title={title}>
      <Swatch id={id} />
      <span className="max-w-[8.5rem] truncate font-medium">{short}</span>
    </span>
  );
}
