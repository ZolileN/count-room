import { partyColour } from "@/lib/parties";

export interface SeatGroup {
  id: number;
  short: string;
  seats: number;
}

interface Dot {
  x: number;
  y: number;
  theta: number;
  row: number;
}

/**
 * Seat positions for a hemicycle: rows of concentric arcs, seats per row proportional to the
 * row's radius, then ordered by angle so each party's seats form a wedge.
 */
export function hemicycleLayout(total: number): { dots: Dot[]; r: number; rows: number } {
  if (total <= 0) return { dots: [], r: 0, rows: 0 };
  const rows = Math.max(1, Math.min(12, Math.round(Math.sqrt(total / 3.2))));
  const inner = rows === 1 ? 1 : 0.38;
  const radii = Array.from({ length: rows }, (_, i) => (rows === 1 ? 1 : inner + ((1 - inner) * i) / (rows - 1)));
  const sum = radii.reduce((a, r) => a + r, 0);
  const counts = radii.map((r) => Math.max(1, Math.round((total * r) / sum)));
  let diff = total - counts.reduce((a, c) => a + c, 0);
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) {
    if (diff > 0) {
      counts[i]!++;
      diff--;
    } else if (counts[i]! > 1) {
      counts[i]!--;
      diff++;
    }
  }
  const dots: Dot[] = [];
  radii.forEach((r, row) => {
    const n = counts[row]!;
    for (let j = 0; j < n; j++) {
      const theta = n === 1 ? Math.PI / 2 : Math.PI * (1 - j / (n - 1));
      dots.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), theta, row });
    }
  });
  dots.sort((a, b) => b.theta - a.theta || a.row - b.row);
  const rowGap = rows === 1 ? 0.3 : (1 - inner) / (rows - 1);
  const arcGap = Math.min(...radii.map((r, i) => (Math.PI * r) / Math.max(1, counts[i]! - 1)));
  const r = Math.min(rowGap, arcGap) * 0.42;
  return { dots, r, rows };
}

export function Hemicycle({ groups, total, majority, caption }: { groups: SeatGroup[]; total: number; majority: number; caption: string }) {
  const { dots, r } = hemicycleLayout(total);
  const owners: SeatGroup[] = [];
  for (const g of groups) for (let i = 0; i < g.seats; i++) owners.push(g);
  const W = 2.2;
  const H = 1.15;
  const label = `${caption}: ${groups.filter((g) => g.seats > 0).map((g) => `${g.short} ${g.seats}`).join(", ")}; ${total} seats, ${majority} needed for a majority.`;
  return (
    <figure className="m-0">
      <svg viewBox={`${-W / 2} ${-1.08} ${W} ${H}`} width="100%" role="img" aria-label={label} className="block max-h-72">
        <line x1="0" x2="0" y1={-1.07} y2={-0.3} stroke="var(--ink-3)" strokeWidth="0.008" strokeDasharray="0.025 0.02" />
        {dots.map((d, i) => {
          const g = owners[i];
          return (
            <circle key={i} cx={d.x} cy={-d.y} r={r} fill={g ? partyColour(g.id) : "var(--track)"}>
              {g ? <title>{`${g.short}: ${g.seats} seats`}</title> : null}
            </circle>
          );
        })}
        <text x="0" y="0.02" textAnchor="middle" fontSize="0.16" fontWeight="700" fill="var(--ink)" className="display">
          {total}
        </text>
        <text x="0" y="-0.17" textAnchor="middle" fontSize="0.065" fill="var(--ink-2)">
          {majority} for majority
        </text>
      </svg>
    </figure>
  );
}
