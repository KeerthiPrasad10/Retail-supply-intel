export function pct(x: number, signed = true): string {
  const v = Math.round(x * 100);
  return `${signed && v > 0 ? "+" : ""}${v}%`;
}

export function compact(x: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(x);
}

export function compactUsd(x: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "USD",
  }).format(x);
}

export function num(x: number, digits = 2): string {
  return x.toFixed(digits);
}
