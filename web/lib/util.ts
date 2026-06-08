export const cc = (...a: Array<string | false | null | undefined>): string =>
  a.filter(Boolean).join(" ");

export const fmtPct = (f: number, signed = true): string => {
  const v = Math.round(f * 100);
  return (signed && v > 0 ? "+" : "") + v + "%";
};

export const fmtMoney = (v: number): string => {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(0) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(0) + "k";
  return "$" + v.toFixed(0);
};

/** Compact "time ago" from a millisecond gap, e.g. 7_200_000 -> "2h ago". */
export const ago = (ms: number): string => {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
};

/** Deterministic short date ("8 Jun") — safe for server render / hydration. */
export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
