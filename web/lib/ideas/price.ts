// Shared price parsing used by several research agents.
export function parsePrice(input?: string | null): { value: number | null; currency: string } {
  if (!input) return { value: null, currency: "" };
  const text = String(input).replace(/,/g, "");
  const currencyMatch = text.match(/(A\$|US\$|\$|£|€|¥|USD|AUD|GBP|EUR|NZD|CAD)/i);
  const numberMatch = text.match(/(\d+(?:\.\d{1,2})?)/);
  const rawCur = currencyMatch ? currencyMatch[1].toUpperCase() : "";
  const currency = rawCur
    .replace("US$", "USD")
    .replace("A$", "AUD")
    .replace("$", "USD");
  return {
    value: numberMatch ? parseFloat(numberMatch[1]) : null,
    currency,
  };
}

export function priceRangeOf(
  rows: { priceValue: number | null; currency: string }[]
): { min: number; max: number; avg: number; currency: string } | null {
  const values = rows.map((r) => r.priceValue).filter((v): v is number => v != null && v > 0);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const currency = rows.find((r) => r.currency)?.currency || "USD";
  return { min, max, avg, currency };
}
