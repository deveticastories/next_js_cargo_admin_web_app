import { Pencil, Trash2 } from "lucide-react";
import type { ColumnConfig, RecordWithId } from "@/types";
import { colors } from "@/utils/colors";
import { Button } from "@/components/ui/Button";

export interface DataTableProps<T extends RecordWithId> {
  columns: ColumnConfig<T>[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyText?: string;
  /** Id of the row whose delete/status-toggle request is in flight, if any — that row's delete button spins and every action on it disables. */
  busyRowId?: string | null;
}

/** Generic list table — every module (bookings, containers, senders, …) renders through this. */
export function DataTable<T extends RecordWithId>({
  columns,
  rows,
  onEdit,
  onDelete,
  emptyText = "No records yet.",
  busyRowId = null,
}: DataTableProps<T>) {
  if (!rows.length) return <div className="cc-empty">{emptyText}</div>;

  const showActions = Boolean(onEdit || onDelete);

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
          {rows.map((row) => {
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
                      {onEdit && (
                        <Button variant="ghost" onClick={() => onEdit(row)} disabled={isBusy} aria-label="Edit">
                          <Pencil size={15} />
                        </Button>
                      )}
                      {onDelete && (
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
    </div>
  );
}
