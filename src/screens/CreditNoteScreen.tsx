"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ApiError } from "@/utils/apiClient";
import { fmtDate, money } from "@/utils/format";
import type { CreditNoteEntry } from "@/types";

/**
 * Petty cash fund — every entry adds to a balance that carries forward automatically.
 * Balances mirror cargo-backend's petty cash: sum of credit notes, less all daily expenses.
 */
export function CreditNoteScreen() {
  const { creditNotes, dailyExpenses } = useCargoData();
  const [modalRow, setModalRow] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<{ amount?: string; description?: string }>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const balance = creditNotes.items.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalExpenses = dailyExpenses.items.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const remainingBalance = balance - totalExpenses;

  const openNew = () => {
    setForm({});
    setModalRow("new");
    setError("");
  };
  const openEdit = (row: CreditNoteEntry) => {
    setForm({ amount: String(row.amount), description: row.description ?? "" });
    setModalRow(row.id);
    setError("");
  };

  const save = async () => {
    if (!form.amount || !(Number(form.amount) >= 0)) {
      setError("Enter an amount.");
      return;
    }
    setSaving(true);
    try {
      const payload = { amount: form.amount, description: form.description || "" };
      if (modalRow === "new") await creditNotes.create(payload);
      else await creditNotes.update(modalRow as string, payload);
      setModalRow(null);
      setForm({});
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the fund entry.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: CreditNoteEntry) => {
    if (!window.confirm(`Delete the ${money(row.amount)} fund entry from ${fmtDate(row.date)}?`)) return;
    setDeletingId(row.id);
    try {
      await creditNotes.remove(row.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete the fund entry.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="cc-stat-grid">
        <StatCard label="Petty cash balance" value={money(balance)} note="Carries forward automatically to next month" />
        <StatCard label="Balance after expenses" value={money(remainingBalance)} note="Petty cash balance minus daily expenses" />
      </div>
      <div className="cc-card">
        <div className="cc-panel-head">
          <div>
            <div className="cc-panel-title">Fund entries</div>
            <div className="cc-panel-desc">Petty cash added this period</div>
          </div>
          <Button variant="primary" onClick={openNew}>
            <Plus size={15} /> Add fund
          </Button>
        </div>
        {creditNotes.loading ? (
          <SkeletonTable columns={3} />
        ) : (
          <DataTable
            columns={[
              { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
              { key: "amount", label: "Amount", render: (r) => money(r.amount) },
              { key: "description", label: "Description" },
            ]}
            rows={creditNotes.items}
            onEdit={openEdit}
            onDelete={remove}
            busyRowId={deletingId}
          />
        )}
      </div>
      {modalRow && (
        <Modal
          title={modalRow === "new" ? "Add fund" : "Edit fund"}
          onClose={() => setModalRow(null)}
          onSubmit={save}
          submitLabel={modalRow === "new" ? "Add fund" : "Save"}
          submitting={saving}
        >
          <Field field={{ key: "amount", label: "Amount", type: "number" }} value={form.amount} onChange={(_, v) => setForm({ ...form, amount: v })} />
          <Field field={{ key: "description", label: "Description", type: "textarea" }} value={form.description} onChange={(_, v) => setForm({ ...form, description: v })} />
          {error && <div className="cc-error">{error}</div>}
        </Modal>
      )}
    </div>
  );
}
