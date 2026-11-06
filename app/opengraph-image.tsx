import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/config";
import { loadNational } from "@/lib/data";
import { fmtAsOf, fmtPct, pctOf } from "@/lib/format";
import { OTHER_ID } from "@/lib/iec/types";
import { OG, OG_SIZE, ogPartyColour } from "@/lib/og/theme";

export const revalidate = 60;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${APP_NAME}: live 2026 local election results`;

/** Live preview card for link shares: current national shares and council counts. */
export default async function Image() {
  const r = await loadNational();
  const n = r.ok ? r.value.data : null;
  const top = n ? n.parties.filter((p) => p.id !== OTHER_ID).slice(0, 5) : [];
  const max = Math.max(1, ...top.map((p) => p.pct));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.bg, color: OG.ink, padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>{APP_NAME}</div>
          <div style={{ fontSize: 28, color: OG.ink2 }}>2026 local elections · live</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 14 }}>
          {top.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 170, fontSize: 34, fontWeight: 700 }}>{p.short}</div>
              <div style={{ display: "flex", flex: 1, height: 34, background: OG.line, borderRadius: 6 }}>
                <div style={{ width: `${(p.pct / max) * 100}%`, height: 34, background: ogPartyColour(p.id), borderRadius: 6 }} />
              </div>
              <div style={{ width: 150, fontSize: 34, fontWeight: 700, textAlign: "right", justifyContent: "flex-end", display: "flex" }}>{fmtPct(p.pct)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", fontSize: 26, color: OG.ink2 }}>
          <div style={{ display: "flex", gap: 28 }}>
            {n ? <span>{fmtPct(pctOf(n.progress.vdsComplete, n.progress.vdsExpected), 0)} of voting districts in</span> : null}
            {n ? <span style={{ color: OG.hung, fontWeight: 700 }}>{n.hung} hung councils</span> : null}
            {n ? <span>{n.majority} with a majority</span> : null}
          </div>
          <span>{n ? fmtAsOf(n.reportDate) : ""}</span>
        </div>
        <div style={{ display: "flex", fontSize: 20, color: OG.ink2, marginTop: 10 }}>Source: IEC. Provisional until declared. Vote share of ballots counted so far.</div>
      </div>
    ),
    size,
  );
}
