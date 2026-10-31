import type { PaginationMeta } from "@/lib/api/types";

/**
 * Decision #16 pagination footer, shared by every list surface: previous /
 * next around an explicit "page X of Y", plus the raw total. Out-of-range
 * choices are prevented client-side; the API additionally whitelists.
 */
export function Pager({
  meta,
  onPage,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
}) {
  if (meta.totalPages <= 1 && meta.total <= meta.limit) {
    // Single page of results at the current limit — nothing to page through.
    return null;
  }

  return (
    <div className="pager">
      <button
        type="button"
        onClick={() => onPage(meta.page - 1)}
        disabled={meta.page <= 1}
      >
        Previous
      </button>
      <span>
        Page {meta.page} of {meta.totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPage(meta.page + 1)}
        disabled={meta.page >= meta.totalPages}
      >
        Next
      </button>
      <span className="pagerMeta">
        {meta.total} total
      </span>
    </div>
  );
}
