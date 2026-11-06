export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "hung" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "hung" ? "border-hung/40 bg-hung-bg" : "border-line bg-surface"}`}>
      <div className={`text-xs font-medium ${tone === "hung" ? "text-hung-ink" : "text-ink-2"}`}>{label}</div>
      <div className="display mt-0.5 text-3xl font-bold leading-tight num">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-ink-2">{sub}</div> : null}
    </div>
  );
}
