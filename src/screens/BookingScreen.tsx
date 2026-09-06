"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { StatCard } from "@/components/ui/StatCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ApiError } from "@/utils/apiClient";
import { fmtDate, todayISO, toDateInputValue } from "@/utils/format";
import type { Booking } from "@/types";

/** Create and track shipment bookings — the entry point of the whole cargo workflow. */
export function BookingScreen() {
  const { bookings, senders, receivers, pickupPartners } = useCargoData();
  const [query, setQuery] = useState("");
  const [modalRow, setModalRow] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");

  const pickupOptions = [
    "Our Pickup Boy",
    "Direct to Store",
    ...pickupPartners.items.filter((p) => p.status === "Active").map((p) => p.name),
  ];
  const filtered = bookings.items.filter((b) =>
    Object.values(b).some((v) => String(v).toLowerCase().includes(query.toLowerCase()))
  );
  const readyBundles = bookings.items
    .filter((b) => b.repackingStatus === "Ready to Ship")
    .reduce((sum, b) => sum + Number(b.bundleCount || 0), 0);

  const openNew = () => {
    setForm({ date: todayISO(), billOption: "With Bill", repackingStatus: "Repacking Required", status: "Active" });
    setModalRow("new");
    setError("");
  };
  const openEdit = (row: Booking) => {
    setForm({ ...row, date: toDateInputValue(row.date) });
    setModalRow(row.id);
    setError("");
  };

  const save = async () => {
    if (!form.sender || !form.receiver || !form.pickupOption || !form.bundleCount) {
      setError("Sender, receiver, pickup option and bundle count are required.");
      return;
    }
    try {
      if (modalRow === "new") await bookings.create(form);
      else await bookings.update(modalRow as string, form);
      setModalRow(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  const removeBooking = async (row: Booking) => {
    if (!window.confirm(`Delete booking ${row.code}?`)) return;
    try {
      await bookings.remove(row.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete booking.");
    }
  };

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="cc-stat-grid">
        <StatCard label="Total bookings" value={bookings.items.length} />
        <StatCard label="Ready-to-ship bundles" value={readyBundles} />
      </div>
      <div className="cc-card">
        <div className="cc-panel-head">
          <div>
            <div className="cc-panel-title">Bookings</div>
            <div className="cc-panel-desc">Every shipment booked, with its current pack status</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SearchBar value={query} onChange={setQuery} placeholder="Search bookings" />
            <Button variant="primary" onClick={openNew}>
              <Plus size={15} /> New booking
            </Button>
          </div>
        </div>
        {bookings.error && <div className="cc-error" style={{ padding: "0 18px 12px" }}>{bookings.error}</div>}
        {bookings.loading ? (
          <div className="cc-empty">Loading…</div>
        ) : (
          <DataTable
            columns={[
              { key: "code", label: "Booking ID" },
              { key: "sender", label: "Sender" },
              { key: "receiver", label: "Receiver" },
              { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
              { key: "bundleCount", label: "Bundles" },
              { key: "billOption", label: "Bill", render: (r) => <Badge value={r.billOption} /> },
              { key: "repackingStatus", label: "Pack status", render: (r) => <Badge value={r.repackingStatus} /> },
              { key: "stuffed", label: "Stuffed", render: (r) => (r.stuffed ? <Badge value="Stuffed" /> : "—") },
              { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
            ]}
            rows={filtered}
            onEdit={openEdit}
            onDelete={removeBooking}
          />
        )}
      </div>
      {modalRow && (
        <Modal title={modalRow === "new" ? "New booking" : "Edit booking"} onClose={() => setModalRow(null)} onSubmit={save} submitLabel="Save booking">
          <div className="cc-grid-2">
            <Field field={{ key: "sender", label: "Sender", type: "select", options: senders.items.map((s) => s.name) }} value={form.sender} onChange={set} />
            <Field field={{ key: "receiver", label: "Receiver", type: "select", options: receivers.items.map((r) => r.name) }} value={form.receiver} onChange={set} />
          </div>
          <Field field={{ key: "pickupOption", label: "Pick up via", type: "select", options: pickupOptions }} value={form.pickupOption} onChange={set} />
          <div className="cc-grid-2">
            <Field field={{ key: "date", label: "Booking date", type: "date" }} value={form.date} onChange={set} />
            <Field field={{ key: "billOption", label: "Bill option", type: "select", options: ["With Bill", "Without Bill"] }} value={form.billOption} onChange={set} />
          </div>
          <div className="cc-grid-2">
            <Field field={{ key: "bundleCount", label: "Bundle count", type: "number" }} value={form.bundleCount} onChange={set} />
            <Field field={{ key: "repackingStatus", label: "Pack status", type: "select", options: ["Ready to Ship", "Repacking Required"] }} value={form.repackingStatus} onChange={set} />
          </div>
          <Field field={{ key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] }} value={form.status} onChange={set} />
          {error && <div className="cc-error">{error}</div>}
        </Modal>
      )}
    </div>
  );
}
