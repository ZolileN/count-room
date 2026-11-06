import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h1 className="display text-2xl font-bold">Not found</h1>
      <p className="mt-1 text-sm text-ink-2">
        There is no council or page at this address. <Link href="/councils" className="underline">See all councils</Link>.
      </p>
    </div>
  );
}
