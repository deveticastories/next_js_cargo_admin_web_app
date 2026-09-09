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
import { fmtDate, money, todayISO } from "@/utils/format";

/** Petty cash fund — every entry adds to a balance that carries forward automatically. */
export function CreditNoteScreen() {
  const { creditNotes } = useCargoData();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{ amount?: string; description?: string }>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const balance = creditNotes.items.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const save = async () => {
    if (!form.amount) {
      setError("Enter an amount.");
      return;
    }
    setSaving(true);
    try {
      await creditNotes.create({ date: todayISO(), amount: form.amount, description: form.description || "" });
      setModalOpen(false);
      setForm({});
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add fund.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="cc-stat-grid">
        <StatCard label="Petty cash balance" value={money(balance)} note="Carries forward automatically to next month" />
      </div>
      <div className="cc-card">
        <div className="cc-panel-head">
          <div>
            <div className="cc-panel-title">Fund entries</div>
            <div className="cc-panel-desc">Petty cash added this period</div>
          </div>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
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
            rows={creditNotes.items.slice().reverse()}
          />
        )}
      </div>
      {modalOpen && (
        <Modal title="Add fund" onClose={() => setModalOpen(false)} onSubmit={save} submitLabel="Add fund" submitting={saving}>
          <Field field={{ key: "amount", label: "Amount", type: "number" }} value={form.amount} onChange={(_, v) => setForm({ ...form, amount: v })} />
          <Field field={{ key: "description", label: "Description", type: "textarea" }} value={form.description} onChange={(_, v) => setForm({ ...form, description: v })} />
          {error && <div className="cc-error">{error}</div>}
        </Modal>
      )}
    </div>
  );
}
