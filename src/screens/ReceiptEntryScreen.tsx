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
import { updateDeliveryPartnerStatus } from "@/services/ReceiptEntryServices";
import { fmtDate, money, todayISO, toDateInputValue } from "@/utils/format";
import type { DeliveryPartnerStatus, ReceiptEntry } from "@/types";

/**
 * Payments received against invoices generated on the Invoicing screen. An invoice can be paid
 * over several receipts — each one records what was still receivable at the time, and
 * cargo-backend stores the resulting balance. The delivery partner's share rides on the receipt.
 */
export function ReceiptEntryScreen() {
  const { receiptEntries, invoices } = useCargoData();
  const [query, setQuery] = useState("");
  const [modalRow, setModalRow] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const receiptsFor = (invoiceId: string, exceptId?: string) =>
    receiptEntries.items.filter((r) => r.invoiceId === invoiceId && r.id !== exceptId);
  const receivedSoFar = (invoiceId: string, exceptId?: string) =>
    receiptsFor(invoiceId, exceptId).reduce((sum, r) => sum + Number(r.receivedAmount || 0), 0);
  const outstanding = (invoiceId: string, exceptId?: string) => {
    const invoice = invoices.items.find((i) => i.id === invoiceId);
    return Math.max(0, Number(invoice?.amount ?? 0) - receivedSoFar(invoiceId, exceptId));
  };

  const changeDeliveryStatus = async (row: ReceiptEntry, status: DeliveryPartnerStatus) => {
    setStatusBusyId(row.id);
    try {
      await updateDeliveryPartnerStatus(row.id, status);
      await receiptEntries.refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update the delivery partner status.");
    } finally {
      setStatusBusyId(null);
    }
  };

  // Once the delivery partner amount is settled, the receipt is locked (no edit / delete).
  const isDeliveryPaid = (r: ReceiptEntry) => r.deliveryPartnerStatus === "Paid";

  const filtered = receiptEntries.items.filter((r) =>
    Object.values(r).some((v) => String(v).toLowerCase().includes(query.toLowerCase()))
  );

  const editingId = modalRow && modalRow !== "new" ? modalRow : undefined;
  const selectedInvoiceId = (form.invoiceId as string) ?? "";
  const selectedInvoice = invoices.items.find((i) => i.id === selectedInvoiceId);
  // Only invoices with something left to collect are offered (the one being edited always stays).
  const invoiceChoices = invoices.items.filter((i) => i.id === selectedInvoiceId || outstanding(i.id) > 0);
  const receivable = selectedInvoiceId ? outstanding(selectedInvoiceId, editingId) : 0;

  const openNew = () => {
    setForm({ receivedDate: todayISO() });
    setModalRow("new");
    setError("");
  };
  const openEdit = (row: ReceiptEntry) => {
    setForm({
      invoiceId: row.invoiceId,
      receivedDate: toDateInputValue(row.receivedDate),
      receivedAmount: String(row.receivedAmount),
      deliveryPartnerAmount: String(row.deliveryPartnerAmount),
    });
    setModalRow(row.id);
    setError("");
  };

  const pickInvoice = (code: string) => {
    const invoice = invoices.items.find((i) => i.code === code);
    // The delivery partner's charge is owed once per invoice — prefill it only on the invoice's first receipt.
    const dpAmount = invoice && receiptsFor(invoice.id).length === 0 ? Number(invoice.deliveryCharge ?? 0) : 0;
    setForm({ ...form, invoiceId: invoice?.id ?? "", receivedAmount: "", deliveryPartnerAmount: String(dpAmount) });
  };

  const save = async () => {
    if (!form.receivedDate || !selectedInvoice) {
      setError("Received date and invoice number are required.");
      return;
    }
    const received = Number(form.receivedAmount);
    if (!(received > 0)) {
      setError("Enter the received amount.");
      return;
    }
    const dpAmount = Number(form.deliveryPartnerAmount || 0);
    if (!(dpAmount >= 0)) {
      setError("Delivery partner amount can't be negative.");
      return;
    }
    const payload = {
      invoiceId: selectedInvoice.id,
      invoiceNo: selectedInvoice.code,
      receivableAmount: receivable,
      receivedAmount: received,
      receivedDate: form.receivedDate,
      deliveryPartnerAmount: dpAmount,
      ...(modalRow === "new" && { date: todayISO() }),
    };
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
    if (!window.confirm(`Delete the ${money(row.receivedAmount)} receipt for ${row.invoiceNo}?`)) return;
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
        {receiptEntries.loading ? (
          <SkeletonTable columns={8} />
        ) : (
          <DataTable
            columns={[
              {
                key: "invoiceDate",
                label: "Date",
                render: (r) => {
                  const inv = invoices.items.find((i) => i.id === r.invoiceId);
                  return inv?.createdAt ? fmtDate(inv.createdAt) : fmtDate(r.date);
                },
              },
              { key: "invoiceNo", label: "Invoice number" },
              { key: "receivableAmount", label: "Receivable amount", render: (r) => money(r.receivableAmount) },
              { key: "receivedAmount", label: "Received amount", render: (r) => money(r.receivedAmount) },
              {
                key: "balanceAmount",
                label: "Balance amount",
                render: (r) => (
                  <span style={r.balanceAmount < 0 ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{money(r.balanceAmount)}</span>
                ),
              },
              { key: "receivedDate", label: "Received date", render: (r) => fmtDate(r.receivedDate) },
              {
                key: "deliveryPartnerAmount",
                label: "Delivery partner amount",
                render: (r) => {
                  const partner = invoices.items.find((i) => i.id === r.invoiceId)?.deliveryPartner;
                  return <span title={partner}>{money(r.deliveryPartnerAmount)}</span>;
                },
              },
              {
                key: "deliveryPartnerStatus",
                label: "Delivery partner status",
                render: (r) => (
                  <select
                    value={r.deliveryPartnerStatus}
                    disabled={statusBusyId === r.id}
                    onChange={(e) => changeDeliveryStatus(r, e.target.value as DeliveryPartnerStatus)}
                    style={{ padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                ),
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
          <Field field={{ key: "receivedDate", label: "Received date", type: "date", required: true }} value={form.receivedDate} onChange={set} />
          <Field
            field={{
              key: "invoiceNo",
              label: "Invoice number",
              type: "search-select",
              placeholder: "Choose invoice number",
              required: true,
              options: invoiceChoices.map((i) => i.code),
              optionLabels: Object.fromEntries(invoiceChoices.map((i) => [i.code, `${i.code} · ${i.bookingCode}`])),
              disabled: modalRow !== "new",
            }}
            value={selectedInvoice?.code ?? ""}
            onChange={(_, code) => pickInvoice(code)}
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
              <Field
                field={{
                  key: "deliveryPartnerAmount",
                  label: `Delivery partner amount${selectedInvoice.deliveryPartner ? ` (${selectedInvoice.deliveryPartner})` : ""}`,
                  type: "number",
                }}
                value={form.deliveryPartnerAmount}
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
