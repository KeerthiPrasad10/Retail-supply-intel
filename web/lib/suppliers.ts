/* Illustrative supplier directory — the Phase-3 "supplier entity resolution"
 * layer the platform is built toward. Companies, origins and categories come
 * from the researched supplier table in the pipeline store (LKA sources
 * exclusively from Asia, so the directory is Asian-origin only); the
 * commercial details (MOQ, lead, capacity, price index) model what resolved
 * supplier data would look like so the trending -> suppliers flow can be
 * demonstrated. */

import type { Supplier, SupplierMatch, Trend } from "./types";

const S = (
  id: string, name: string, cc: string, cats: string[], match: number,
  certs: string[], moq: string, lead: string, capacity: string, price: number,
  est: number, verified: boolean, note: string,
): Supplier => ({ id, name, cc, cats, match, certs, moq, lead, capacity, price, est, verified, note });

export const SUPPLIERS: Supplier[] = [
  // Audio & Earbuds
  S("S-CN-27", "Goertek", "CN", ["Audio & Earbuds"], 95, ["CE", "RoHS", "ISO 9001"], "2k units", "32 d", "400k /mo", 95, 2009, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-28", "Luxshare", "CN", ["Audio & Earbuds"], 86, ["CE", "RoHS"], "4k units", "38 d", "250k /mo", 105, 2016, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-29", "AAC Technologies", "CN", ["Audio & Earbuds"], 77, ["CE", "RoHS"], "5k units", "44 d", "100k /mo", 115, 1990, true, "Established export manufacturer; mature QA and EU lanes."),
  // Beauty & Cosmetics
  S("S-KR-01", "Cosmax", "KR", ["Beauty & Cosmetics"], 95, ["ISO 22716", "GMP", "Cruelty-free"], "3k units", "30 d", "350k /mo", 95, 1992, true, "Premium tier; strong R&D and finish quality."),
  S("S-KR-02", "Kolmar Korea", "KR", ["Beauty & Cosmetics"], 89, ["ISO 22716", "GMP"], "4k units", "34 d", "273k /mo", 103, 1999, true, "Premium tier; strong R&D and finish quality."),
  S("S-CN-03", "Yixin Cosmetics", "CN", ["Beauty & Cosmetics"], 83, ["ISO 22716", "GMP"], "5k units", "38 d", "197k /mo", 110, 2006, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-KR-41", "Saehan Cosmetics", "KR", ["Beauty & Cosmetics"], 77, ["ISO 22716", "GMP", "Cruelty-free"], "6k units", "42 d", "120k /mo", 118, 2008, false, "Premium tier; strong R&D and finish quality."),
  // Candles & Home Fragrance
  S("S-CN-25", "Quanzhou Yongchun", "CN", ["Candles & Home Fragrance"], 95, ["IFRA", "SEDEX", "ISO 9001"], "2k units", "28 d", "400k /mo", 85, 1995, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-IN-26", "Hosley", "IN", ["Candles & Home Fragrance"], 89, ["IFRA", "SEDEX"], "4k units", "33 d", "307k /mo", 97, 2002, true, "Scale producer; broad range, improving compliance."),
  S("S-IN-42", "MIC Exports", "IN", ["Candles & Home Fragrance"], 83, ["IFRA", "SEDEX"], "6k units", "39 d", "213k /mo", 109, 2015, true, "Scale producer; broad range, improving compliance."),
  S("S-CN-43", "Qingdao Aroma Home", "CN", ["Candles & Home Fragrance"], 77, ["IFRA", "SEDEX", "ISO 9001"], "8k units", "44 d", "120k /mo", 121, 1989, false, "Established export manufacturer; mature QA and EU lanes."),
  // Coffee
  S("S-VN-07", "Trung Nguyen", "VN", ["Coffee"], 95, ["ISO 22000", "Rainforest Alliance", "4C"], "4 t", "28 d", "5,000 t/mo", 88, 2001, true, "Competitive cost base; growing EU client roster."),
  S("S-VN-08", "Vinacafe", "VN", ["Coffee"], 86, ["ISO 22000", "Rainforest Alliance"], "14 t", "37 d", "2,675 t/mo", 103, 2008, true, "Competitive cost base; growing EU client roster."),
  S("S-ID-09", "Santos Jaya Abadi", "ID", ["Coffee"], 77, ["ISO 22000", "Rainforest Alliance"], "24 t", "46 d", "350 t/mo", 118, 2015, true, "Regional specialist; competitive on resource-based lines."),
  // Drinkware & Tumblers
  S("S-CN-23", "Haers", "CN", ["Drinkware & Tumblers"], 95, ["BRCGS", "ISO 9001", "SEDEX"], "5k units", "26 d", "1,200k /mo", 88, 2014, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-24", "Sup Drinkware", "CN", ["Drinkware & Tumblers"], 89, ["BRCGS", "ISO 9001"], "7k units", "31 d", "900k /mo", 96, 1988, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-39", "KingStar", "CN", ["Drinkware & Tumblers"], 83, ["BRCGS", "ISO 9001"], "10k units", "35 d", "600k /mo", 104, 1994, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-40", "Ansheng Technology", "CN", ["Drinkware & Tumblers"], 77, ["BRCGS", "ISO 9001", "SEDEX"], "12k units", "40 d", "300k /mo", 112, 2001, false, "Established export manufacturer; mature QA and EU lanes."),
  // Footwear
  S("S-VN-10", "Pou Chen", "VN", ["Footwear"], 95, ["ISO 14001", "WRAP", "REACH"], "1k pairs", "30 d", "700k /mo", 86, 1989, true, "Competitive cost base; growing EU client roster."),
  S("S-VN-11", "Feng Tay", "VN", ["Footwear"], 91, ["ISO 14001", "WRAP"], "2k pairs", "34 d", "590k /mo", 93, 1996, true, "Competitive cost base; growing EU client roster."),
  S("S-VN-12", "Lai Yih", "VN", ["Footwear"], 88, ["ISO 14001", "WRAP"], "3k pairs", "37 d", "480k /mo", 99, 2003, true, "Competitive cost base; growing EU client roster."),
  S("S-VN-32", "TBS Group", "VN", ["Footwear"], 84, ["ISO 14001", "WRAP", "REACH"], "3k pairs", "41 d", "370k /mo", 106, 2011, false, "Competitive cost base; growing EU client roster."),
  S("S-VN-33", "Gia Dinh Group", "VN", ["Footwear"], 81, ["ISO 14001", "WRAP"], "4k pairs", "44 d", "260k /mo", 112, 1985, true, "Competitive cost base; growing EU client roster."),
  S("S-CN-34", "Mescot", "CN", ["Footwear"], 77, ["ISO 14001", "WRAP"], "5k pairs", "48 d", "150k /mo", 119, 1992, true, "Established export manufacturer; mature QA and EU lanes."),
  // Knitwear & Apparel
  S("S-CN-13", "Crystal International", "CN", ["Knitwear & Apparel"], 95, ["OEKO-TEX", "BSCI", "GOTS"], "2k units", "30 d", "1,500k /mo", 85, 2010, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-14", "Shenzhou International", "CN", ["Knitwear & Apparel"], 91, ["OEKO-TEX", "BSCI"], "4k units", "34 d", "1,230k /mo", 91, 2017, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-BD-15", "Beximco", "BD", ["Knitwear & Apparel"], 88, ["OEKO-TEX", "BSCI"], "5k units", "37 d", "960k /mo", 97, 1991, true, "High-capacity, cost-led production; longer lead."),
  S("S-BD-16", "DBL Group", "BD", ["Knitwear & Apparel"], 84, ["OEKO-TEX", "BSCI", "GOTS"], "7k units", "41 d", "690k /mo", 104, 1998, false, "High-capacity, cost-led production; longer lead."),
  S("S-BD-35", "Interstoff Apparels", "BD", ["Knitwear & Apparel"], 81, ["OEKO-TEX", "BSCI"], "8k units", "44 d", "420k /mo", 110, 1999, true, "High-capacity, cost-led production; longer lead."),
  S("S-BD-36", "NR Group", "BD", ["Knitwear & Apparel"], 77, ["OEKO-TEX", "BSCI"], "10k units", "48 d", "150k /mo", 116, 2006, true, "High-capacity, cost-led production; longer lead."),
  // Pet Care
  S("S-TH-30", "Charoen Pokphand Foods", "TH", ["Pet Care"], 95, ["ISO 9001", "BSCI", "SEDEX"], "3k units", "30 d", "600k /mo", 84, 1997, true, "Mid-tier specialist; reliable on-time record."),
  S("S-CN-31", "Gambol Pet", "CN", ["Pet Care"], 89, ["ISO 9001", "BSCI"], "5k units", "35 d", "450k /mo", 92, 2004, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-TH-44", "i-Tail (Thai Union)", "TH", ["Pet Care"], 83, ["ISO 9001", "BSCI"], "6k units", "39 d", "300k /mo", 100, 1996, true, "Mid-tier specialist; reliable on-time record."),
  S("S-TH-45", "Asian Alliance International", "TH", ["Pet Care"], 77, ["ISO 9001", "BSCI", "SEDEX"], "8k units", "44 d", "150k /mo", 108, 2003, false, "Mid-tier specialist; reliable on-time record."),
  // Small Kitchen Appliances
  S("S-CN-20", "Midea", "CN", ["Small Kitchen Appliances"], 95, ["CE", "LFGB", "ISO 9001"], "2k units", "34 d", "500k /mo", 88, 1993, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-21", "Joyoung", "CN", ["Small Kitchen Appliances"], 86, ["CE", "LFGB"], "4k units", "41 d", "300k /mo", 100, 2000, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-22", "Guangdong Xinbao", "CN", ["Small Kitchen Appliances"], 77, ["CE", "LFGB"], "6k units", "48 d", "100k /mo", 112, 2007, true, "Established export manufacturer; mature QA and EU lanes."),
  // Tea & Matcha
  S("S-JP-04", "Aiya", "JP", ["Tea & Matcha"], 95, ["ISO 22000", "Organic EU", "Rainforest Alliance"], "2 t", "26 d", "800 t/mo", 86, 2013, true, "Premium tier; exacting QC, smaller batches."),
  S("S-JP-05", "Marukyu Koyamaen", "JP", ["Tea & Matcha"], 86, ["ISO 22000", "Organic EU"], "4 t", "36 d", "500 t/mo", 99, 1987, true, "Premium tier; exacting QC, smaller batches."),
  S("S-CN-06", "Zhejiang Tea Group", "CN", ["Tea & Matcha"], 77, ["ISO 22000", "Organic EU"], "6 t", "46 d", "200 t/mo", 112, 1994, true, "Established export manufacturer; mature QA and EU lanes."),
  // Toys & Collectibles
  S("S-CN-17", "Pop Mart", "CN", ["Toys & Collectibles"], 95, ["ICTI", "EN 71", "ISO 9001"], "3k units", "32 d", "800k /mo", 86, 2005, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-18", "Goldlok Toys", "CN", ["Toys & Collectibles"], 91, ["ICTI", "EN 71"], "5k units", "36 d", "638k /mo", 92, 2012, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-19", "Winning Crown", "CN", ["Toys & Collectibles"], 86, ["ICTI", "EN 71"], "6k units", "39 d", "475k /mo", 98, 1986, true, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-37", "A-One Toys", "CN", ["Toys & Collectibles"], 81, ["ICTI", "EN 71", "ISO 9001"], "8k units", "42 d", "312k /mo", 104, 2013, false, "Established export manufacturer; mature QA and EU lanes."),
  S("S-CN-38", "D King Group", "CN", ["Toys & Collectibles"], 77, ["ICTI", "EN 71"], "10k units", "46 d", "150k /mo", 110, 1987, true, "Established export manufacturer; mature QA and EU lanes."),
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
