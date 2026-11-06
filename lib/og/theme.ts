/** Fixed light palette for social preview images (no CSS variables in image rendering). */
import { PARTY_COLOURS, FALLBACK_COLOURS, fallbackIndex } from "../parties";

export const OG = { bg: "#f6f5f1", ink: "#16181b", ink2: "#474c54", line: "#e2dfd8", hung: "#b45309", hungBg: "#fdf0d5" };
export const OG_SIZE = { width: 1200, height: 630 };

export function ogPartyColour(id: number): string {
  return PARTY_COLOURS[id]?.light ?? FALLBACK_COLOURS[fallbackIndex(id)]!.light;
}
