/**
 * Map the world-atlas topojson country ids (ISO 3166-1 *numeric*) to our
 * ISO 3166-1 alpha-2 codes. NOTE: these are the standard ISO numeric codes used
 * by the `world-atlas` topojson, which differ from UN Comtrade's M49 codes for
 * a few countries (e.g. France, India, USA) — so this table is independent of
 * the pipeline's reference mapping on purpose.
 */
export const ALPHA2_TO_ISO_NUM: Record<string, number> = {
  DE: 276, GB: 826, FR: 250, IT: 380, ES: 724, NL: 528, PL: 616, AT: 40,
  BE: 56, IE: 372, PT: 620, SE: 752, DK: 208, FI: 246, CZ: 203, RO: 642,
  HU: 348, GR: 300, US: 840, CN: 156, VN: 704, IN: 356, TR: 792, BD: 50,
  ID: 360, TH: 764, KH: 116, PK: 586, JP: 392, KR: 410, MX: 484, BR: 76,
  MA: 504,
};

const ISO_NUM_TO_ALPHA2: Record<number, string> = Object.fromEntries(
  Object.entries(ALPHA2_TO_ISO_NUM).map(([a2, num]) => [num, a2]),
);

/** Resolve a topojson geography id (string|number) to our alpha-2 code. */
export function geoIdToAlpha2(id: string | number | undefined): string | null {
  if (id === undefined || id === null) return null;
  const n = typeof id === "number" ? id : parseInt(String(id), 10);
  return ISO_NUM_TO_ALPHA2[n] ?? null;
}
