import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { ColumnConfig, RecordWithId } from "@/types";
import { colors } from "@/utils/colors";
import { Button } from "@/components/ui/Button";

export interface DataTableProps<T extends RecordWithId> {
  columns: ColumnConfig<T>[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Return false to hide the delete button for a row. */
  canDelete?: (row: T) => boolean;
  /** Hides a row's edit button when it returns false. */
  canEdit?: (row: T) => boolean;
  emptyText?: string;
  /** Id of the row whose delete/status-toggle request is in flight, if any — that row's delete button spins and every action on it disables. */
  busyRowId?: string | null;
  /** Show this many rows per page with numbered page buttons underneath. Omit to render every row. */
  pageSize?: number;
}

/** Page numbers to show — first, last, and a window around the current page, with "…" for the gaps. */
function pageList(current: number, total: number): (number | "…")[] {
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - current) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return pages;
}

/** Generic list table — every module (bookings, containers, senders, …) renders through this. */
export function DataTable<T extends RecordWithId>({
  columns,
  rows,
  onEdit,
  onDelete,
  canDelete,
  canEdit,
  emptyText = "No records yet.",
  busyRowId = null,
  pageSize,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);

  if (!rows.length) return <div className="cc-empty">{emptyText}</div>;

  const showActions = Boolean(onEdit || onDelete);
  const totalPages = pageSize ? Math.ceil(rows.length / pageSize) : 1;
  // Clamp rather than reset, so a search or delete that shrinks the list never leaves an empty page.
  const currentPage = Math.min(page, totalPages);
  const visibleRows = pageSize ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;

  return (
    <div className="cc-table-wrap">
      <table className="cc-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {showActions && <th></th>}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const isBusy = busyRowId === row.id;
            return (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.render ? c.render(row) : String((row as unknown as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
                {showActions && (
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {onEdit && (!canEdit || canEdit(row)) && (
                        <Button variant="ghost" onClick={() => onEdit(row)} disabled={isBusy} aria-label="Edit">
                          <Pencil size={15} />
                        </Button>
                      )}
                      {onDelete && (!canDelete || canDelete(row)) && (
                        <Button variant="ghost" onClick={() => onDelete(row)} loading={isBusy} aria-label="Delete">
                          {!isBusy && <Trash2 size={15} color={colors.danger} />}
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {pageSize && totalPages > 1 && (
        <div className="cc-pagination">
          <span className="cc-pagination-info">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} of {rows.length}
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <Button size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
              <ChevronLeft size={14} />
            </Button>
            {pageList(currentPage, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="cc-pagination-info">…</span>
              ) : (
                <Button
                  key={p}
                  size="sm"
                  className={p === currentPage ? "cc-btn-tab" : ""}
                  onClick={() => setPage(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                >
                  {p}
                </Button>
              )
            )}
            <Button size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
