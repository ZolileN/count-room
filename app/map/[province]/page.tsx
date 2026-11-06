import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AsOf } from "@/components/AsOf";
import { CouncilMap } from "@/components/CouncilMap";
import { toMapCouncils } from "@/lib/map-councils";
import { DataNotice, Unavailable } from "@/components/DataNotice";
import { loadNational } from "@/lib/data";
import { PROVINCE_IDS } from "@/lib/config";

export const revalidate = 60;
export function generateStaticParams() {
  return PROVINCE_IDS.map((p) => ({ province: String(p) }));
}

type Props = { params: Promise<{ province: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province } = await params;
  const r = await loadNational();
  const name = r.ok ? r.value.data.provinces.find((p) => String(p.id) === province)?.name : undefined;
  return { title: name ? `${name} map` : "Map" };
}

export default async function ProvinceMapPage({ params }: Props) {
  const { province } = await params;
  const id = Number(province);
  if (!(PROVINCE_IDS as readonly number[]).includes(id)) notFound();
  const r = await loadNational();
  if (!r.ok) return <Unavailable what="The map" />;
  const n = r.value.data;
  const p = n.provinces.find((x) => x.id === id);
  return (
    <>
      <DataNotice s={r.value} />
      <h1 className="display text-3xl font-bold sm:text-4xl">{p?.name ?? "Province"}</h1>
      <p className="mb-4 mt-1 text-sm text-ink-2">
        {p ? `${p.hung} hung, ${p.majority} with a majority, ${p.progress.municsExpected - p.progress.municsComplete} still counting. ` : ""}
        <AsOf iso={n.reportDate} />
      </p>
      <CouncilMap councils={toMapCouncils(n.councils)} provinces={n.provinces.map((x) => ({ id: x.id, name: x.name }))} provinceId={id} />
    </>
  );
}
