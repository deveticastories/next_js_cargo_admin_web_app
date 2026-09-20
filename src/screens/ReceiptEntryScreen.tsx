"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ApiError } from "@/utils/apiClient";
import { fmtDate, money, todayISO, toDateInputValue } from "@/utils/format";
import type { ReceiptEntry } from "@/types";

/** Payments received against invoices generated on the Invoicing screen. */
export function ReceiptEntryScreen() {
  const { receiptEntries, invoices, deliveryPartners } = useCargoData();
  const [query, setQuery] = useState("");
  const [modalRow, setModalRow] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const receivedSoFar = (invoiceNo: string, exceptId?: string) =>
    receiptEntries.items
      .filter((r) => r.invoiceNo === invoiceNo && r.id !== exceptId)
      .reduce((sum, r) => sum + Number(r.receivedAmount || 0), 0);

  // Balance per receipt = invoice amount less everything received on that invoice up to and including this receipt.
  const balanceById = new Map<string, number>();
  const running = new Map<string, number>();
  [...receiptEntries.items]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.code.localeCompare(b.code))
    .forEach((r) => {
      const total = (running.get(r.invoiceNo) ?? 0) + Number(r.receivedAmount || 0);
      running.set(r.invoiceNo, total);
      balanceById.set(r.id, Number(r.invoiceAmount || 0) - total);
    });

  const changeDeliveryStatus = async (invoiceId: string, status: string) => {
    setStatusBusyId(invoiceId);
    try {
      await invoices.update(invoiceId, { deliveryPaymentStatus: status });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update the delivery partner status.");
    } finally {
      setStatusBusyId(null);
    }
  };

  // Once the delivery partner amount is settled, the receipt is locked (no edit / delete).
  const isDeliveryPaid = (r: ReceiptEntry) =>
    invoices.items.find((i) => i.code === r.invoiceNo)?.deliveryPaymentStatus === "Paid";

  const filtered = receiptEntries.items.filter((r) =>
    Object.values(r).some((v) => String(v).toLowerCase().includes(query.toLowerCase()))
  );

  // An invoice that already has a submitted receipt isn't offered again (the one being edited stays).
  const receiptedInvoices = new Set(receiptEntries.items.map((r) => r.invoiceNo));
  const invoiceChoices = invoices.items.filter((i) => !receiptedInvoices.has(i.code) || i.code === form.invoiceNo);

  const selectedInvoice = (form.invoiceNo as string) ?? "";
  const editingId = modalRow && modalRow !== "new" ? modalRow : undefined;
  const invoiceTotal = Number(invoices.items.find((i) => i.code === selectedInvoice)?.amount ?? 0);
  const receivable = Math.max(0, invoiceTotal - receivedSoFar(selectedInvoice, editingId));

  const openNew = () => {
    setForm({ date: todayISO() });
    setModalRow("new");
    setError("");
  };
  const openEdit = (row: ReceiptEntry) => {
    setForm({ ...row, date: toDateInputValue(row.date) });
    setModalRow(row.id);
    setError("");
  };

  const save = async () => {
    if (!form.date || !selectedInvoice) {
      setError("Date and invoice number are required.");
      return;
    }
    const received = Number(form.receivedAmount);
    if (!(received > 0)) {
      setError("Enter the received amount.");
      return;
    }
    const payload = { date: form.date, invoiceNo: selectedInvoice, invoiceAmount: invoiceTotal, receivedAmount: received };
    setSaving(true);
    try {
      if (modalRow === "new") await receiptEntries.create(payload);
      else await receiptEntries.update(modalRow as string, payload);
      setModalRow(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeReceipt = async (row: ReceiptEntry) => {
    if (!window.confirm(`Delete receipt ${row.code}?`)) return;
    setDeletingId(row.id);
    try {
      await receiptEntries.remove(row.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete receipt.");
    } finally {
      setDeletingId(null);
    }
  };

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="cc-card">
        <div className="cc-panel-head">
          <div>
            <div className="cc-panel-title">Receipt entry</div>
            <div className="cc-panel-desc">Payments received against invoices</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SearchBar value={query} onChange={setQuery} placeholder="Search receipts" />
            <Button variant="primary" onClick={openNew}>
              <Plus size={15} /> Add receipt entry
            </Button>
          </div>
        </div>
        {receiptEntries.error && <div className="cc-alert-error" style={{ margin: "14px 18px 0" }}>{receiptEntries.error}</div>}
        {receiptEntries.loading ? (
          <SkeletonTable columns={8} />
        ) : (
          <DataTable
            columns={[
              {
                key: "invoiceDate",
                label: "Date",
                render: (r) => {
                  const inv = invoices.items.find((i) => i.code === r.invoiceNo);
                  return inv?.createdAt ? fmtDate(inv.createdAt) : "—";
                },
              },
              { key: "invoiceNo", label: "Invoice number" },
              { key: "invoiceAmount", label: "Receivable amount", render: (r) => money(r.invoiceAmount) },
              { key: "receivedAmount", label: "Received amount", render: (r) => money(r.receivedAmount) },
              {
                key: "balance",
                label: "Balance amount",
                render: (r) => {
                  const balance = balanceById.get(r.id) ?? 0;
                  return <span style={balance < 0 ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{money(balance)}</span>;
                },
              },
              { key: "date", label: "Received date", render: (r) => fmtDate(r.date) },
              {
                key: "deliveryCharge",
                label: "Delivery partner amount",
                render: (r) => {
                  const inv = invoices.items.find((i) => i.code === r.invoiceNo);
                  if (!inv?.deliveryPartner) return "—";
                  const charge = inv.deliveryCharge || Number(deliveryPartners.items.find((d) => d.name === inv.deliveryPartner)?.charge ?? 0);
                  return <span title={inv.deliveryPartner}>{money(charge)}</span>;
                },
              },
              {
                key: "deliveryPaymentStatus",
                label: "Delivery partner status",
                render: (r) => {
                  const inv = invoices.items.find((i) => i.code === r.invoiceNo);
                  if (!inv) return "—";
                  return (
                    <select
                      value={inv.deliveryPaymentStatus ?? "Pending"}
                      disabled={statusBusyId === inv.id}
                      onChange={(e) => changeDeliveryStatus(inv.id, e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                    </select>
                  );
                },
              },
            ]}
            rows={filtered}
            onEdit={openEdit}
            onDelete={removeReceipt}
            canEdit={(r) => !isDeliveryPaid(r)}
            canDelete={(r) => !isDeliveryPaid(r)}
            busyRowId={deletingId}
          />
        )}
        <div
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Total received: {money(filtered.reduce((sum, r) => sum + Number(r.receivedAmount || 0), 0))}
        </div>
      </div>
      {modalRow && (
        <Modal
          title={modalRow === "new" ? "Add receipt entry" : "Edit receipt entry"}
          onClose={() => setModalRow(null)}
          onSubmit={save}
          submitLabel="Submit"
          submitting={saving}
        >
          <Field field={{ key: "date", label: "Date", type: "date", required: true }} value={form.date} onChange={set} />
          <Field
            field={{
              key: "invoiceNo",
              label: "Invoice number",
              type: "select",
              required: true,
              options: invoiceChoices.map((i) => i.code),
              optionLabels: Object.fromEntries(invoiceChoices.map((i) => [i.code, `${i.code} · ${i.bookingCode}`])),
              disabled: modalRow !== "new",
            }}
            value={form.invoiceNo}
            onChange={(k, v) => setForm({ ...form, [k]: v, receivedAmount: "" })}
          />
          {selectedInvoice && (
            <>
              <Field
                field={{ key: "receivable", label: "Invoice amount (receivable amount)", type: "text", disabled: true }}
                value={money(receivable)}
                onChange={() => {}}
              />
              <Field
                field={{ key: "receivedAmount", label: "Received amount", type: "number", required: true }}
                value={form.receivedAmount}
                onChange={set}
              />
            </>
          )}
          {error && <div className="cc-error">{error}</div>}
        </Modal>
      )}
    </div>
  );
}
