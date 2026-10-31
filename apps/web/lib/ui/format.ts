/** Presentation-only formatting shared by the admin surfaces. */

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}
