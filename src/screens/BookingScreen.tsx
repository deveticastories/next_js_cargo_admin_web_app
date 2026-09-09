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
import { Loading } from "@/components/ui/Loading";
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
    setForm({
      date: todayISO(),
      billOption: "With Bill",
      bundleType: "Bundle",
      productType: "Normal",
      repackingStatus: "Repacking Required",
      status: "Active",
    });
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
    // Each extra charge only applies under its own condition — zero it out
    // here (regardless of what's still sitting in the hidden field) so a
    // charge typed in while its condition held can never be saved once the
    // booking no longer meets it (e.g. product type switched away from
    // "Branded" after a brand handling charge was entered).
    const payload = {
      ...form,
      brandHandlingCharge: form.productType === "Branded" ? Number(form.brandHandlingCharge) || 0 : 0,
      pickupCharge: form.billOption === "Without Bill" ? Number(form.pickupCharge) || 0 : 0,
      bundleHandlingCharge: Number(form.bundleCount) < 5 ? Number(form.bundleHandlingCharge) || 0 : 0,
    };
    try {
      if (modalRow === "new") await bookings.create(payload);
      else await bookings.update(modalRow as string, payload);
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

  const showBrandHandlingCharge = form.productType === "Branded";
  const showPickupCharge = form.billOption === "Without Bill";
  const showBundleHandlingCharge = Number(form.bundleCount) > 0 && Number(form.bundleCount) < 5;

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
        {bookings.error && <div className="cc-alert-error" style={{ margin: "14px 18px 0" }}>{bookings.error}</div>}
        {bookings.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "code", label: "Booking ID" },
              { key: "sender", label: "Sender" },
              { key: "receiver", label: "Receiver" },
              { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
              { key: "bundleCount", label: "Bundles" },
              { key: "bundleType", label: "Bundle type" },
              { key: "productType", label: "Product type" },
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
            <Field field={{ key: "bundleType", label: "Bundle type", type: "select", options: ["Bundle", "Box", "CBM", "KG"] }} value={form.bundleType} onChange={set} />
          </div>
          <div className="cc-grid-2">
            <Field field={{ key: "productType", label: "Product type", type: "select", options: ["Branded", "Normal"] }} value={form.productType} onChange={set} />
            <Field field={{ key: "repackingStatus", label: "Pack status", type: "select", options: ["Ready to Ship", "Repacking Required"] }} value={form.repackingStatus} onChange={set} />
          </div>
          {(showBrandHandlingCharge || showPickupCharge || showBundleHandlingCharge) && (
            <div className="cc-grid-2">
              {showBrandHandlingCharge && (
                <Field
                  field={{ key: "brandHandlingCharge", label: "Brand handling charge", type: "number" }}
                  value={form.brandHandlingCharge}
                  onChange={set}
                />
              )}
              {showPickupCharge && (
                <Field field={{ key: "pickupCharge", label: "Pickup charge", type: "number" }} value={form.pickupCharge} onChange={set} />
              )}
              {showBundleHandlingCharge && (
                <Field
                  field={{ key: "bundleHandlingCharge", label: "Bundle handling charge (below 5 bundles)", type: "number" }}
                  value={form.bundleHandlingCharge}
                  onChange={set}
                />
              )}
            </div>
          )}
          <Field field={{ key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] }} value={form.status} onChange={set} />
          {error && <div className="cc-error">{error}</div>}
        </Modal>
      )}
    </div>
  );
}
