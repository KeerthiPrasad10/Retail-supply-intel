/* Illustrative supplier directory — the Phase-3 "supplier entity resolution"
 * layer the platform is built toward. Origins/categories align with the real
 * trade-flow data; the per-company details model what resolved supplier data
 * would look like so the trending -> suppliers flow can be demonstrated. */

import type { Supplier, SupplierMatch, Trend } from "./types";

const S = (
  id: string, name: string, cc: string, cats: string[], match: number,
  certs: string[], moq: string, lead: string, capacity: string, price: number,
  est: number, verified: boolean, note: string,
): Supplier => ({ id, name, cc, cats, match, certs, moq, lead, capacity, price, est, verified, note });

export const SUPPLIERS: Supplier[] = [
  // Coffee — Vietnam / Indonesia
  S("S-VN-01", "Simexco Daklak", "VN", ["Coffee"], 94, ["Rainforest Alliance", "4C", "ISO 9001"], "18 t", "35 d", "2,400 t/mo", 98, 1993, true, "Buon Ma Thuot robusta co-op; full traceability to farm."),
  S("S-VN-02", "Intimex Group", "VN", ["Coffee"], 89, ["UTZ", "Fairtrade", "ISO 22000"], "24 t", "40 d", "5,000 t/mo", 95, 1995, true, "Largest VN exporter by volume; reliable bulk green."),
  S("S-VN-03", "An Thai Coffee JSC", "VN", ["Coffee"], 82, ["HACCP", "ISO 9001"], "6 t", "28 d", "900 t/mo", 104, 2005, true, "Instant + roasted; private-label capable."),
  S("S-ID-01", "PT Sumatra Specialty", "ID", ["Coffee"], 78, ["Organic EU", "Rainforest Alliance"], "4 t", "45 d", "350 t/mo", 118, 2009, false, "Single-origin Mandheling arabica; specialty tier."),
  // Drinkware — Poland / Spain
  S("S-PL-01", "Krosno Glass S.A.", "PL", ["Drinkware & Tumblers"], 92, ["BRCGS", "ISO 14001", "SEDEX"], "5k units", "30 d", "1.2M /mo", 101, 1923, true, "Heritage glassworks; EU-made, low transport leadtime."),
  S("S-PL-02", "Decorglass Sp. z o.o.", "PL", ["Drinkware & Tumblers"], 85, ["BSCI", "ISO 9001"], "10k units", "28 d", "800k /mo", 96, 2001, true, "Decorated tumblers + double-wall; print in-house."),
  S("S-ES-01", "Vidrios San Miguel", "ES", ["Drinkware & Tumblers"], 80, ["BRCGS", "Recycled-glass cert"], "8k units", "32 d", "600k /mo", 108, 1948, true, "100% recycled glass line; strong sustainability story."),
  // Knitwear — Turkey / Portugal / Pakistan
  S("S-TR-01", "Ege Tekstil A.Ş.", "TR", ["Knitwear & Apparel"], 93, ["GOTS", "OEKO-TEX", "SEDEX"], "3k units", "32 d", "450k /mo", 100, 1988, true, "Izmir vertical knit; quick-turn near-shore."),
  S("S-TR-02", "Bursa Knit Works", "TR", ["Knitwear & Apparel"], 86, ["OEKO-TEX", "BSCI"], "5k units", "35 d", "300k /mo", 97, 1996, true, "Heavy-gauge knitwear; good winter range capability."),
  S("S-PT-01", "Tintex Têxteis", "PT", ["Knitwear & Apparel"], 84, ["GOTS", "OEKO-TEX", "bluesign"], "2k units", "30 d", "180k /mo", 116, 1998, true, "Premium circular knits; EU-made, very low MOQ."),
  S("S-PK-01", "Interloop Ltd", "PK", ["Knitwear & Apparel", "Footwear"], 79, ["SEDEX", "ISO 14001", "WRAP"], "10k units", "48 d", "1.5M /mo", 88, 1992, true, "Hosiery + knit giant; lowest unit cost, longer lead."),
  // Footwear — Portugal / Romania / Vietnam
  S("S-PT-02", "Kyaia Group", "PT", ["Footwear"], 90, ["ISO 9001", "SEDEX", "REACH"], "1.2k pairs", "34 d", "220k /mo", 119, 1984, true, "São João da Madeira cluster; premium leather, EU-made."),
  S("S-RO-01", "Carpathian Footwear", "RO", ["Footwear"], 83, ["BSCI", "REACH"], "2k pairs", "30 d", "160k /mo", 102, 2003, true, "Near-shore EU assembly; competitive on casual lines."),
  S("S-VN-04", "Saigon Stepway Mfg.", "VN", ["Footwear"], 81, ["WRAP", "ISO 14001"], "5k pairs", "42 d", "700k /mo", 90, 2007, true, "High-volume sneakers; strong cost, established lanes."),
  // Tea & Matcha — Poland / India
  S("S-PL-03", "Mokate Group", "PL", ["Tea & Matcha", "Coffee"], 88, ["BRCGS", "IFS", "ISO 22000"], "3 t", "26 d", "600 t/mo", 99, 1990, true, "EU tea + instant packer; private-label specialist."),
  S("S-IN-01", "Nilgiri Leaf Estates", "IN", ["Tea & Matcha"], 82, ["Rainforest Alliance", "Organic EU"], "2 t", "46 d", "400 t/mo", 94, 1981, true, "Direct estate tea; organic and CTC grades."),
  // Audio — Belgium / Romania
  S("S-BE-01", "Sonarc Audio NV", "BE", ["Audio & Earbuds"], 86, ["ISO 9001", "CE", "RoHS"], "2k units", "38 d", "120k /mo", 112, 2011, true, "EU design + assembly; TWS earbuds, private-label."),
  S("S-RO-02", "Carpathian Acoustics", "RO", ["Audio & Earbuds"], 80, ["CE", "RoHS", "ISO 14001"], "3k units", "36 d", "160k /mo", 104, 2015, false, "Near-shore PCBA + final assembly; growing capacity."),
  // Candles — Spain / India
  S("S-ES-02", "Cerería Mollá 1899", "ES", ["Candles & Home Fragrance"], 89, ["IFRA", "ISO 9001"], "2k units", "30 d", "140k /mo", 121, 1899, true, "Premium scented candles; EU-made heritage brand."),
  S("S-IN-02", "Aroma Works India", "IN", ["Candles & Home Fragrance"], 79, ["IFRA", "SEDEX"], "6k units", "44 d", "380k /mo", 86, 2008, true, "Soy + paraffin at scale; lowest cost, longer lead."),
  // Beauty — Poland
  S("S-PL-04", "Dr Irena Eris Labs", "PL", ["Beauty & Cosmetics"], 87, ["ISO 22716", "GMP", "Vegan cert"], "3k units", "34 d", "250k /mo", 107, 1983, true, "EU GMP colour + skincare; private-label R&D."),
  S("S-PL-05", "Inglot Sp. z o.o.", "PL", ["Beauty & Cosmetics"], 83, ["ISO 22716", "Cruelty-free"], "5k units", "36 d", "300k /mo", 110, 1983, true, "Colour cosmetics specialist; broad shade ranges."),
];

export function suppliersFor(trend: Trend): SupplierMatch[] {
  const origins = new Set([...trend.sources, ...trend.emerging].map((s) => s[0]));
  return SUPPLIERS.filter((s) => s.cats.includes(trend.cat))
    .map((s) => ({
      ...s,
      onTrendOrigin: origins.has(s.cc),
      isEmerging: trend.emerging.some((e) => e[0] === s.cc),
    }))
    .sort((a, b) => b.match - a.match);
}
