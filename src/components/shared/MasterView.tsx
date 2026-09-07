"use client";

/**
 * Generic master/detail CRUD screen: search + table + add/edit modal,
 * backed by a live API collection (see `useApiCollection`). This single
 * component powers Team, Stores, Delivery partners, Pickup partners,
 * Pricing, Pickup assign, Daily expense, and both tabs of Customers — every
 * screen just supplies its `fields`/`columns` and an `ApiCollection`. Code
 * generation and duplicate-checking happen server-side, so this component
 * doesn't need to know about either.
 */

import { useMemo, useState, type ReactNode } from "react";
import type { ColumnConfig, FieldConfig, RecordWithId, Status } from "@/types";
import { ApiError } from "@/utils/apiClient";
import { toDateInputValue } from "@/utils/format";
import type { ApiCollection } from "@/utils/useApiCollection";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Loading } from "@/components/ui/Loading";
import { Plus } from "lucide-react";

export interface MasterViewProps<T extends RecordWithId> {
  title: string;
  desc: string;
  fields: FieldConfig[];
  columns: ColumnConfig<T>[];
  collection: ApiCollection<T>;
  /** Set false for records with no Active/Inactive status (e.g. pricing, expenses). */
  hasStatus?: boolean;
  footer?: (rows: T[]) => ReactNode;
}

const STATUS_FIELD: FieldConfig = { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function MasterView<T extends RecordWithId>({
  title,
  desc,
  fields,
  columns,
  collection,
  hasStatus = true,
  footer,
}: MasterViewProps<T>) {
  const { items: rows, loading, error: loadError, create, update, remove } = collection;
  const [query, setQuery] = useState("");
  const [modalRow, setModalRow] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, query]);

  const openNew = () => {
    setForm(hasStatus ? { status: "Active" as Status } : {});
    setModalRow("new");
    setFormError("");
  };
  const openEdit = (row: T) => {
    const raw = row as unknown as Record<string, unknown>;
    // Date fields need `YYYY-MM-DD` to populate an <input type="date">,
    // but the API returns full ISO timestamps.
    const withDateFields = { ...raw };
    for (const f of fields) {
      if (f.type === "date") withDateFields[f.key] = toDateInputValue(raw[f.key]);
    }
    setForm(withDateFields);
    setModalRow(row.id);
    setFormError("");
  };
  const close = () => setModalRow(null);

  const save = async () => {
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? "").trim()) {
        setFormError(`${f.label} is required.`);
        return;
      }
    }
    try {
      if (modalRow === "new") await create(form);
      else await update(modalRow as string, form);
      close();
    } catch (err) {
      setFormError(errorMessage(err, "Something went wrong. Please try again."));
    }
  };

  const handleDelete = async (row: T) => {
    const label = (row as { name?: string; code?: string }).name || (row as { code?: string }).code || row.id;
    if (!window.confirm(`Remove ${label}?`)) return;
    try {
      await remove(row.id);
    } catch (err) {
      alert(errorMessage(err, "Failed to delete."));
    }
  };

  const toggleStatus = async (row: T) => {
    const current = (row as { status?: Status }).status;
    try {
      await update(row.id, { status: current === "Active" ? "Inactive" : "Active" });
    } catch (err) {
      alert(errorMessage(err, "Failed to update status."));
    }
  };

  const allColumns: ColumnConfig<T>[] = hasStatus
    ? [
        ...columns,
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <span onClick={() => toggleStatus(row)} style={{ cursor: "pointer" }}>
              <Badge value={(row as { status?: Status }).status} />
            </span>
          ),
        },
      ]
    : columns;

  return (
    <div className="cc-card">
      <div className="cc-panel-head">
        <div>
          <div className="cc-panel-title">{title}</div>
          <div className="cc-panel-desc">{desc}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SearchBar value={query} onChange={setQuery} />
          <Button variant="primary" onClick={openNew}>
            <Plus size={15} /> New
          </Button>
        </div>
      </div>
      {loadError && <div className="cc-alert-error" style={{ margin: "14px 18px 0" }}>{loadError}</div>}
      {loading ? (
        <Loading />
      ) : (
        <DataTable columns={allColumns} rows={filtered} onEdit={openEdit} onDelete={handleDelete} />
      )}
      {footer?.(rows)}
      {modalRow && (
        <Modal title={modalRow === "new" ? `Add ${title}` : `Edit ${title}`} onClose={close} onSubmit={save}>
          {fields.map((f) => (
            <Field
              key={f.key}
              field={f}
              value={form[f.key]}
              onChange={(k, v) => setForm({ ...form, [k]: v })}
              error={formError && f.required && !form[f.key] ? formError : null}
            />
          ))}
          {hasStatus && (
            <Field field={STATUS_FIELD} value={form.status} onChange={(k, v) => setForm({ ...form, [k]: v })} />
          )}
          {formError && <div className="cc-error">{formError}</div>}
        </Modal>
      )}
    </div>
  );
}
