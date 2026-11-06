/**
 * City labels for the maps. Tier 1 shows on the national map; tier 2 joins when zoomed into a
 * province. `side` is where the label sits relative to the dot, chosen so neighbours don't collide
 * and labels near the coast stay on the map.
 */
export type LabelSide = "right" | "left" | "above" | "below";

export interface City {
  name: string;
  lon: number;
  lat: number;
  provinceId: number;
  tier: 1 | 2;
  side: LabelSide;
}

export const CITIES: City[] = [
  // Tier 1: metros and provincial capitals.
  { name: "Johannesburg", lon: 28.0473, lat: -26.2041, provinceId: 3, tier: 1, side: "left" },
  { name: "Pretoria", lon: 28.2293, lat: -25.7479, provinceId: 3, tier: 1, side: "above" },
  { name: "Cape Town", lon: 18.4241, lat: -33.9249, provinceId: 9, tier: 1, side: "right" },
  { name: "Durban", lon: 31.0218, lat: -29.8587, provinceId: 4, tier: 1, side: "right" },
  { name: "Pietermaritzburg", lon: 30.3794, lat: -29.6006, provinceId: 4, tier: 2, side: "left" },
  { name: "Gqeberha", lon: 25.6022, lat: -33.9608, provinceId: 1, tier: 1, side: "below" },
  { name: "East London", lon: 27.9116, lat: -33.0153, provinceId: 1, tier: 1, side: "right" },
  { name: "Bhisho", lon: 27.4422, lat: -32.8472, provinceId: 1, tier: 2, side: "left" },
  { name: "Bloemfontein", lon: 26.1596, lat: -29.0852, provinceId: 2, tier: 1, side: "right" },
  { name: "Polokwane", lon: 29.4689, lat: -23.9045, provinceId: 7, tier: 1, side: "right" },
  { name: "Mbombela", lon: 30.9853, lat: -25.4658, provinceId: 5, tier: 1, side: "below" },
  { name: "Kimberley", lon: 24.7499, lat: -28.7282, provinceId: 6, tier: 1, side: "left" },
  { name: "Mahikeng", lon: 25.6403, lat: -25.856, provinceId: 8, tier: 1, side: "left" },
  { name: "Upington", lon: 21.2561, lat: -28.4478, provinceId: 6, tier: 1, side: "left" },
  { name: "George", lon: 22.4617, lat: -33.963, provinceId: 9, tier: 1, side: "below" },
  { name: "Mthatha", lon: 28.7844, lat: -31.5889, provinceId: 1, tier: 1, side: "right" },
  // Tier 2: other large towns, shown when zoomed into a province.
  { name: "Ekurhuleni", lon: 28.1675, lat: -26.2309, provinceId: 3, tier: 2, side: "right" },
  { name: "Vereeniging", lon: 27.9261, lat: -26.6731, provinceId: 3, tier: 2, side: "below" },
  { name: "Rustenburg", lon: 27.2421, lat: -25.6676, provinceId: 8, tier: 2, side: "left" },
  { name: "Klerksdorp", lon: 26.6667, lat: -26.8521, provinceId: 8, tier: 2, side: "below" },
  { name: "Vryburg", lon: 24.7284, lat: -26.9566, provinceId: 8, tier: 2, side: "below" },
  { name: "Welkom", lon: 26.7351, lat: -27.9774, provinceId: 2, tier: 2, side: "left" },
  { name: "Bethlehem", lon: 28.3078, lat: -28.2307, provinceId: 2, tier: 2, side: "right" },
  { name: "Newcastle", lon: 29.9318, lat: -27.7576, provinceId: 4, tier: 2, side: "left" },
  { name: "Richards Bay", lon: 32.0383, lat: -28.7807, provinceId: 4, tier: 2, side: "left" },
  { name: "Port Shepstone", lon: 30.455, lat: -30.7414, provinceId: 4, tier: 2, side: "left" },
  { name: "Komani", lon: 26.8753, lat: -31.8976, provinceId: 1, tier: 2, side: "left" },
  { name: "Stellenbosch", lon: 18.8602, lat: -33.9321, provinceId: 9, tier: 2, side: "below" },
  { name: "Worcester", lon: 19.4485, lat: -33.6465, provinceId: 9, tier: 2, side: "right" },
  { name: "Oudtshoorn", lon: 22.2014, lat: -33.5907, provinceId: 9, tier: 2, side: "above" },
  { name: "Beaufort West", lon: 22.5829, lat: -32.3567, provinceId: 9, tier: 2, side: "right" },
  { name: "Springbok", lon: 17.8865, lat: -29.6643, provinceId: 6, tier: 2, side: "right" },
  { name: "eMalahleni", lon: 29.2332, lat: -25.8713, provinceId: 5, tier: 2, side: "left" },
  { name: "Secunda", lon: 29.1782, lat: -26.5504, provinceId: 5, tier: 2, side: "below" },
  { name: "Thohoyandou", lon: 30.485, lat: -22.9456, provinceId: 7, tier: 2, side: "below" },
  { name: "Tzaneen", lon: 30.1633, lat: -23.8332, provinceId: 7, tier: 2, side: "right" },
];

/** Cities to label: tier 1 nationally; every city in the province when zoomed in. */
export function citiesFor(provinceId?: number): City[] {
  return provinceId === undefined ? CITIES.filter((c) => c.tier === 1) : CITIES.filter((c) => c.provinceId === provinceId);
}
