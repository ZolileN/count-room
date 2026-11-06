/**
 * Feed-drift reporting. The IEC feed is undocumented; when it changes shape we log once per
 * distinct message (per server instance) and keep going with whatever parsed.
 */
const seen = new Set<string>();
let collector: string[] | null = null;

export function drift(message: string): void {
  if (collector && !collector.includes(message)) collector.push(message);
  if (seen.has(message)) return;
  seen.add(message);
  if (seen.size > 500) seen.clear();
  console.warn(`[iec drift] ${message}`);
}

/** Run `fn` and return the drift messages raised during it alongside its result. */
export function collectDrift<T>(fn: () => T): { value: T; warnings: string[] } {
  const prev = collector;
  const mine: string[] = [];
  collector = mine;
  try {
    return { value: fn(), warnings: mine };
  } finally {
    collector = prev;
  }
}

/** Report keys we expected but didn't find on an object. */
export function checkFields(label: string, obj: unknown, keys: readonly string[]): void {
  if (!obj || typeof obj !== "object") return;
  for (const k of keys) {
    if (!(k in obj)) drift(`${label}: expected field "${k}" is missing`);
  }
}
