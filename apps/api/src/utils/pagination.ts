/**
 * Pagination, sorting and search primitives shared by every list endpoint
 * (doctors, patients). Centralized so the response envelope and query
 * semantics cannot drift between surfaces (decision #16/#17).
 */

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  // An empty list still reports one logical page — totalPages is never zero
  // so paginated UIs can always render "page 1 of 1".
  return { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sort parser shared by both list surfaces: `-prefix` = descending, else
 * ascending. Redundant with validator whitelisting; keeps services safe for
 * any future caller that skips the request layer.
 */
export function buildSort(
  rawSort: string | undefined,
  defaultSort: string,
  allowedFields: readonly string[],
): Record<string, 1 | -1> {
  const raw = rawSort ?? defaultSort;
  const descending = raw.startsWith("-");
  const field = descending ? raw.slice(1) : raw;

  const allowed = allowedFields.includes(field) ? field : defaultSort.replace(/^-/, "");

  return { [allowed]: descending ? -1 : 1 };
}
