import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/config";
import { loadCouncil } from "@/lib/data";
import { fmtAsOf } from "@/lib/format";
import { OG, OG_SIZE, ogPartyColour } from "@/lib/og/theme";

export const revalidate = 60;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Council seats and coalition arithmetic";
export function generateStaticParams(): { id: string }[] {
  return []; // rendered on first request, then cached like the page
}

/** Preview card for a council: seats (declared or modelled) as a bar against the majority line. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = /^\d{1,6}$/.test(id) ? await loadCouncil(Number(id)) : null;
  const v = r && r.ok ? r.value : null;
  const s = v?.detail?.munic.data ?? v?.summary;
  const a = v?.detail?.analysis;
  const rows = a ? a.rows.filter((x) => x.seats > 0).slice(0, 6) : [];
  const status = !s ? "" : s.status === "hung" ? "Hung council" : s.status === "majority" ? "Majority council" : "Still counting";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.bg, color: OG.ink, padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: OG.ink2 }}>
          <span>{APP_NAME} · 2026 local elections</span>
          <span style={{ color: s?.status === "hung" ? OG.hung : OG.ink2, fontWeight: 700 }}>{status}</span>
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, marginTop: 18 }}>{s?.name ?? "Council"}</div>
        {a && s ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
            <div style={{ display: "flex", height: 56, width: "100%", position: "relative", background: OG.line, borderRadius: 8 }}>
              {rows.map((x) => (
                <div key={x.id} style={{ width: `${(x.seats / a.totalSeats) * 100}%`, height: 56, background: ogPartyColour(x.id), borderRight: `3px solid ${OG.bg}` }} />
              ))}
              <div style={{ position: "absolute", left: `${(a.majority / a.totalSeats) * 100}%`, top: -10, width: 4, height: 76, background: OG.ink }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 22, fontSize: 32 }}>
              {rows.map((x) => (
                <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 22, height: 22, background: ogPartyColour(x.id), borderRadius: 4 }} />
                  <span style={{ fontWeight: 700 }}>{x.short}</span>
                  <span>{x.seats}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", fontSize: 24, color: OG.ink2 }}>
          <span>{a ? `${a.totalSeats} seats · ${a.majority} for a majority · ${a.seatsSource === "declared" ? "declared" : "modelled while counting"}` : ""}</span>
          <span>{s ? fmtAsOf(s.reportDate) : ""}</span>
        </div>
        <div style={{ display: "flex", fontSize: 20, color: OG.ink2, marginTop: 10 }}>Source: IEC. Provisional until declared. Seat arithmetic, not a prediction.</div>
      </div>
    ),
    size,
  );
}
