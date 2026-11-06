/**
 * Council seat allocation.
 *
 * Two models:
 *
 * - `allocateSeats` (default while a council is still counting): Droop quota with largest
 *   remainders on PR-ballot votes, over all of the council's seats. A deliberate simplification.
 *
 * - `allocateMixedMember` (experimental, behind SEAT_MODEL=mmp): the compensatory formula in the
 *   Local Government: Municipal Structures Act 117 of 1998, Schedule 1, Part 3. Seats are shared
 *   in proportion to each party's ward + PR votes; ward seats a party has won count towards its
 *   share, PR seats top it up; a party that wins more wards than its share keeps them (overhang)
 *   and the rest are re-shared among the others.
 *
 * Once a council is declared, the IEC's real seat numbers replace both.
 */

/** Seats needed for a majority: floor(seats / 2) + 1. */
export function majorityLine(totalSeats: number): number {
  return Math.floor(totalSeats / 2) + 1;
}

export interface SeatInput {
  id: number;
  votes: number;
}

export interface SeatAllocation {
  id: number;
  seats: number;
}

function byRemainder(a: { rem: number; votes: number; id: number }, b: { rem: number; votes: number; id: number }) {
  return b.rem - a.rem || b.votes - a.votes || a.id - b.id;
}

/**
 * Largest-remainder allocation with a given quota. Ties on remainder go to the party with more
 * votes, then the lower party ID (the IEC breaks real ties by lot).
 */
function largestRemainder(parties: SeatInput[], seats: number, quota: number): Map<number, number> {
  const rows = parties.map((p) => {
    const whole = quota > 0 ? Math.floor(p.votes / quota) : 0;
    return { id: p.id, votes: p.votes, whole, rem: p.votes - whole * quota };
  });
  const out = new Map(rows.map((r) => [r.id, r.whole]));
  let left = seats - rows.reduce((a, r) => a + r.whole, 0);
  const order = rows.filter((r) => r.votes > 0).sort(byRemainder);
  for (let i = 0; left > 0 && order.length > 0; i = (i + 1) % order.length, left--) {
    const r = order[i]!;
    out.set(r.id, (out.get(r.id) ?? 0) + 1);
  }
  // A quota can over-allocate only with pathological inputs; trim from the smallest remainders.
  for (let i = order.length - 1; left < 0 && i >= 0; i--, left++) {
    const r = order[i]!;
    out.set(r.id, Math.max(0, (out.get(r.id) ?? 0) - 1));
  }
  return out;
}

/** Droop quota: floor(V / (S + 1)) + 1. */
export function droopQuota(totalVotes: number, seats: number): number {
  return Math.floor(totalVotes / (seats + 1)) + 1;
}

/**
 * Approximate seat allocation: Droop quota and largest remainders on PR-ballot votes against the
 * council's total seats. Always returns exactly `seats` seats when any party has votes.
 */
export function allocateSeats(parties: SeatInput[], seats: number): SeatAllocation[] {
  const valid = parties.filter((p) => p.votes > 0);
  const total = valid.reduce((a, p) => a + p.votes, 0);
  if (total === 0 || seats <= 0) return parties.map((p) => ({ id: p.id, seats: 0 }));
  const m = largestRemainder(valid, seats, droopQuota(total, seats));
  return parties.map((p) => ({ id: p.id, seats: m.get(p.id) ?? 0 }));
}

export interface MixedMemberParty {
  id: number;
  /** Ward-ballot + PR-ballot votes. */
  votes: number;
  /** Ward seats won (so far, while counting). */
  wardSeats: number;
}

export interface MixedMemberInput {
  parties: MixedMemberParty[];
  seats: number;
  /** Ward seats won by independent candidates; these are fixed and not party seats. */
  independentWardSeats?: number;
}

export interface MixedMemberAllocation extends SeatAllocation {
  wardSeats: number;
  prSeats: number;
  /** Won more wards than its proportional share. */
  overhang: boolean;
}

/**
 * Schedule 1, Part 3 (items 5–9) of the Municipal Structures Act, in outline:
 *
 * 1. quota = floor(A / (B − C)) + 1, where A is the total ward + PR votes for parties,
 *    B the council size, C the ward seats won by independents.
 * 2. Each party's entitlement is floor(votes / quota); seats still unallocated go to the largest
 *    remainders.
 * 3. A party whose ward seats exceed its entitlement keeps its ward seats and gets no PR seats; it
 *    is removed, along with its votes and seats, and steps 1–2 are repeated for the others.
 * 4. PR seats = entitlement − ward seats.
 */
export function allocateMixedMember(input: MixedMemberInput): MixedMemberAllocation[] {
  const ind = input.independentWardSeats ?? 0;
  let active = input.parties.filter((p) => p.votes > 0 || p.wardSeats > 0);
  let available = Math.max(0, input.seats - ind);
  const fixed = new Map<number, number>();
  let ent = new Map<number, number>();

  for (let guard = 0; guard < 50; guard++) {
    const A = active.reduce((a, p) => a + p.votes, 0);
    if (A === 0 || available <= 0) {
      ent = new Map(active.map((p) => [p.id, 0]));
      break;
    }
    const quota = Math.floor(A / available) + 1;
    ent = largestRemainder(active, available, quota);
    const over = active.filter((p) => p.wardSeats > (ent.get(p.id) ?? 0));
    if (over.length === 0) break;
    for (const p of over) {
      fixed.set(p.id, p.wardSeats);
      available -= p.wardSeats;
    }
    const overIds = new Set(over.map((p) => p.id));
    active = active.filter((p) => !overIds.has(p.id));
  }

  return input.parties.map((p) => {
    const f = fixed.get(p.id);
    const seats = f ?? ent.get(p.id) ?? 0;
    const wardSeats = Math.min(p.wardSeats, seats);
    return { id: p.id, seats, wardSeats, prSeats: seats - wardSeats, overhang: f !== undefined };
  });
}
