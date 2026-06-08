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
