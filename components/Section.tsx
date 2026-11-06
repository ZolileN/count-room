export function Section({ title, asOf, children, id, intro }: { title: string; asOf?: React.ReactNode; children: React.ReactNode; id?: string; intro?: React.ReactNode }) {
  return (
    <section aria-labelledby={id ? `${id}-h` : undefined} className="mt-8 first:mt-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id ? `${id}-h` : undefined} className="display text-xl font-bold">{title}</h2>
        {asOf}
      </div>
      {intro ? <div className="mb-3 max-w-prose text-sm text-ink-2">{intro}</div> : null}
      {children}
    </section>
  );
}
