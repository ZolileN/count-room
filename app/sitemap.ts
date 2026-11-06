import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";
import { loadNational } from "@/lib/data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = ["", "/map", "/projection", "/councils", "/metros", "/timeline", "/method"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "always" as const,
    priority: p === "" ? 1 : 0.8,
  }));
  const nat = await loadNational();
  const councils = nat.ok
    ? nat.value.data.councils.map((c) => ({ url: `${base}/councils/${c.id}`, changeFrequency: "hourly" as const, priority: c.kind === "metro" ? 0.7 : 0.5 }))
    : [];
  return [...pages, ...councils];
}
