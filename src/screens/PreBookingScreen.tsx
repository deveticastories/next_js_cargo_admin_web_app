"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { StatCard } from "@/components/ui/StatCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ApiError } from "@/utils/apiClient";
import { fmtDate, todayISO, toDateInputValue } from "@/utils/format";
import type { PreBooking } from "@/types";

/**
 * Book a shipment in before the receiver is known — same workflow as
 * Booking, minus the receiver (a phone number is captured instead so the
 * sender can be reached). See `BookingScreen` for the full-booking version.
 */
export function PreBookingScreen() {
  const router = useRouter();
  const { preBookings, senders } = useCargoData();
  const [query, setQuery] = useState("");
  const [modalRow, setModalRow] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = preBookings.items.filter((b) =>
    Object.values(b).some((v) => String(v).toLowerCase().includes(query.toLowerCase()))
  );
  const readyBundles = preBookings.items
    .filter((b) => b.repackingStatus === "Ready to Ship")
    .reduce((sum, b) => sum + Number(b.bundleCount || 0), 0);
  // Bundle count total per unit of measure, across every pre-booking.
  const bundleTypeTotals: Record<string, number> = { Bundle: 0, Box: 0, CBM: 0, KG: 0 };
  for (const b of preBookings.items) {
    if (b.bundleType && b.bundleType in bundleTypeTotals) {
      bundleTypeTotals[b.bundleType] += Number(b.bundleCount || 0);
    }
  }

  const openNew = () => {
    setForm({
      date: todayISO(),
      // "Pick up via", "Bill option" and "Product type" are no longer shown in this
      // form (per request) but are still required by the backend record — fixed
      // defaults instead of a user choice.
      pickupOption: "Our Pickup Boy",
      billOption: "With Bill",
      bundleType: "Bundle",
      productType: "Normal",
      repackingStatus: "Repacking Required",
      status: "Pending",
    });
    setModalRow("new");
    setError("");
  };
  const openEdit = (row: PreBooking) => {
    setForm({ ...row, date: toDateInputValue(row.date) });
    setModalRow(row.id);
    setError("");
  };

  const save = async () => {
    if (!form.sender || !form.phoneNumber || !form.bundleCount) {
      setError("Sender, phone number and bundle count are required.");
      return;
    }
    // Each extra charge only applies under its own condition — zero it out
    // here (regardless of what's still sitting in the hidden field) so a
    // charge typed in while its condition held can never be saved once the
    // pre-booking no longer meets it (e.g. product type switched away from
    // "Branded" after a brand handling charge was entered).
    const payload = {
      ...form,
      brandHandlingCharge: form.productType === "Branded" ? Number(form.brandHandlingCharge) || 0 : 0,
      pickupCharge: form.billOption === "Without Bill" ? Number(form.pickupCharge) || 0 : 0,
      bundleHandlingCharge: Number(form.bundleCount) < 5 ? Number(form.bundleHandlingCharge) || 0 : 0,
    };
    setSaving(true);
    try {
      if (modalRow === "new") await preBookings.create(payload);
      else await preBookings.update(modalRow as string, payload);
      setModalRow(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const removePreBooking = async (row: PreBooking) => {
    if (!window.confirm(`Delete pre-booking ${row.code}?`)) return;
    setDeletingId(row.id);
    try {
      await preBookings.remove(row.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete pre-booking.");
    } finally {
      setDeletingId(null);
    }
  };

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  // Sender select's own onChange — also fills "Phone number" from that sender's
  // saved WhatsApp number, so it doesn't have to be typed in again. Still a plain
  // editable field afterward, in case this pre-booking needs a different contact.
  const selectSender = (v: string) => {
    const found = senders.items.find((s) => s.name === v);
    setForm({ ...form, sender: v, phoneNumber: found?.whatsapp ?? "" });
  };
  // No matching sender in the dropdown — send the admin to Customers, sender
  // tab, with its "Add" popup already open (and the typed name prefilled).
  const addSenderFromSearch = (typedName: string) => {
    const params = new URLSearchParams({ tab: "sender", newSender: "1" });
    if (typedName) params.set("senderName", typedName);
    router.push(`/admin/customers?${params.toString()}`);
  };

  const showBrandHandlingCharge = form.productType === "Branded";
  const showPickupCharge = form.billOption === "Without Bill";
  const showBundleHandlingCharge = Number(form.bundleCount) > 0 && Number(form.bundleCount) < 5;

  return (
    <div>
      <div className="cc-stat-grid">
        <StatCard label="Total pre-bookings" value={preBookings.items.length} />
        <StatCard label="Ready-to-ship bundles" value={readyBundles} />
        <StatCard label="Box" value={bundleTypeTotals.Box} />
        <StatCard label="Bundles" value={bundleTypeTotals.Bundle} />
        <StatCard label="CBM" value={bundleTypeTotals.CBM} />
        <StatCard label="KG" value={bundleTypeTotals.KG} />
      </div>
      <div className="cc-card">
        <div className="cc-panel-head">
          <div>
            <div className="cc-panel-title">Pre-bookings</div>
            <div className="cc-panel-desc">Shipments booked in before the receiver is known</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SearchBar value={query} onChange={setQuery} placeholder="Search pre-bookings" />
            <Button variant="primary" onClick={openNew}>
              <Plus size={15} /> New pre-booking
            </Button>
          </div>
        </div>
        {preBookings.error && <div className="cc-alert-error" style={{ margin: "14px 18px 0" }}>{preBookings.error}</div>}
        {preBookings.loading ? (
          <SkeletonTable columns={11} />
        ) : (
          <DataTable
            columns={[
              { key: "code", label: "Pre-booking ID" },
              { key: "sender", label: "Sender" },
              { key: "phoneNumber", label: "Phone number" },
              { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
              { key: "bundleCount", label: "Bundles" },
              // Set by the Repacking screen's "Confirm" action, not the pre-booking form — 0/"—" until repacking's been confirmed once.
              { key: "actualBundle", label: "Actual bundle", render: (r) => (r.actualBundle ? r.actualBundle : "—") },
              { key: "bundleType", label: "Bundle type" },
              { key: "productType", label: "Product type" },
              { key: "billOption", label: "Bill", render: (r) => <Badge value={r.billOption} /> },
              { key: "repackingStatus", label: "Pack status", render: (r) => <Badge value={r.repackingStatus} /> },
              { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
            ]}
            rows={filtered}
            onEdit={openEdit}
            onDelete={removePreBooking}
            busyRowId={deletingId}
          />
        )}
      </div>
      {modalRow && (
        <Modal
          title={modalRow === "new" ? "New pre-booking" : "Edit pre-booking"}
          onClose={() => setModalRow(null)}
          onSubmit={save}
          submitLabel="Save pre-booking"
          submitting={saving}
        >
          <div className="cc-grid-2">
            <SearchableSelect
              label="Sender"
              required
              value={(form.sender as string) ?? ""}
              options={senders.items.map((s) => s.name)}
              placeholder="Search sender"
              onChange={selectSender}
              onCreateNew={addSenderFromSearch}
            />
            <Field field={{ key: "phoneNumber", label: "Phone number", type: "text", placeholder: "e.g. +971 50 123 4567" }} value={form.phoneNumber} onChange={set} />
          </div>
          <Field field={{ key: "date", label: "Booking date", type: "date" }} value={form.date} onChange={set} />
          <div className="cc-grid-2">
            <Field field={{ key: "bundleCount", label: "Bundle count", type: "number" }} value={form.bundleCount} onChange={set} />
            <Field field={{ key: "bundleType", label: "Bundle type", type: "select", options: ["Bundle", "Box", "CBM", "KG"] }} value={form.bundleType} onChange={set} />
          </div>
          <div className="cc-grid-2">
            <Field field={{ key: "repackingStatus", label: "Pack status", type: "select", options: ["Ready to Ship", "Repacking Required"] }} value={form.repackingStatus} onChange={set} />
            <Field field={{ key: "status", label: "Status", type: "select", options: ["Pending", "Collected"] }} value={form.status} onChange={set} />
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
          {error && <div className="cc-error">{error}</div>}
        </Modal>
      )}
    </div>
  );
}
