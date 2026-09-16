"use client";

import { useState } from "react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Field } from "@/components/ui/Field";
import { ApiError } from "@/utils/apiClient";
import type { PickupAssign } from "@/types";

/** Assign a transport (pickup partner) and LR number to a collection run. */
export function PickupAssignScreen() {
  const { pickupAssigns, pickupPartners } = useCargoData();
  // Clicking a "Pending" row's Pickup status badge opens this popup to record how many
  // bundles were actually collected, then marks that row "Collected". Once collected,
  // the badge is locked — no popup, no further pickup-status changes from the table.
  const [collectRow, setCollectRow] = useState<PickupAssign | null>(null);
  const [collectedBundleInput, setCollectedBundleInput] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState("");
  // Payment status needs no extra data (unlike Pickup status' bundle count), so a badge
  // click just confirms (via the app-styled `ConfirmModal`, not a browser `window.confirm`)
  // and flips Unpaid <-> Paid.
  const [paymentBusyId, setPaymentBusyId] = useState<string | null>(null);
  const [paymentConfirmRow, setPaymentConfirmRow] = useState<PickupAssign | null>(null);

  const openCollect = (row: PickupAssign) => {
    setCollectRow(row);
    setCollectedBundleInput("");
    setCollectError("");
  };

  const submitCollect = async () => {
    if (!collectRow) return;
    if (!collectedBundleInput || Number(collectedBundleInput) <= 0) {
      setCollectError("Enter how many bundles were collected.");
      return;
    }
    setCollecting(true);
    try {
      await pickupAssigns.update(collectRow.id, {
        pickupStatus: "Collected",
        collectedBundle: Number(collectedBundleInput),
      });
      setCollectRow(null);
    } catch (err) {
      setCollectError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setCollecting(false);
    }
  };

  const confirmTogglePayment = async () => {
    if (!paymentConfirmRow) return;
    const row = paymentConfirmRow;
    setPaymentBusyId(row.id);
    try {
      await pickupAssigns.update(row.id, { paymentStatus: row.paymentStatus === "Paid" ? "Unpaid" : "Paid" });
      setPaymentConfirmRow(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update payment status.");
    } finally {
      setPaymentBusyId(null);
    }
  };

  return (
    <>
      <MasterView
        title="Pickup assign"
        desc="Assign a transport to a collection run"
        fields={[
          {
            key: "transport",
            label: "Choose transport",
            type: "select",
            options: pickupPartners.items.map((p) => p.name),
            required: true,
          },
          { key: "lrNo", label: "LR number", required: true },
          { key: "bundleCount", label: "Number of bundles", type: "number", required: true },
          { key: "amount", label: "Amount", type: "number", required: true },
          { key: "paymentStatus", label: "Payment status", type: "select", options: ["Unpaid", "Paid"], required: true },
          // Pickup status is deliberately not editable here — it starts at "Pending" (see
          // `initialNewValues` below) and only ever moves to "Collected" through the table's
          // own popup, which is the one place `collectedBundle` gets recorded alongside it.
        ]}
        columns={[
          { key: "transport", label: "Transport" },
          { key: "lrNo", label: "LR No" },
          { key: "bundleCount", label: "Bundles" },
          { key: "amount", label: "Amount", render: (r) => r.amount || 0 },
          {
            key: "paymentStatus",
            label: "Payment",
            render: (r) => (
              <span
                onClick={() => paymentBusyId !== r.id && setPaymentConfirmRow(r)}
                style={paymentBusyId === r.id ? { cursor: "default", opacity: 0.5, pointerEvents: "none" } : { cursor: "pointer" }}
                title="Click to toggle Unpaid / Paid"
              >
                <Badge value={r.paymentStatus} />
              </span>
            ),
          },
          {
            key: "pickupStatus",
            label: "Pickup status",
            render: (r) =>
              r.pickupStatus === "Collected" ? (
                <Badge value={r.pickupStatus} />
              ) : (
                <span onClick={() => openCollect(r)} style={{ cursor: "pointer" }} title="Click to record collected bundles">
                  <Badge value={r.pickupStatus} />
                </span>
              ),
          },
          { key: "collectedBundle", label: "Collected bundle", render: (r) => (r.collectedBundle ? r.collectedBundle : "—") },
        ]}
        collection={pickupAssigns}
        initialNewValues={{ paymentStatus: "Unpaid", pickupStatus: "Pending" }}
        confirmStatusToggle
      />

      {collectRow && (
        <Modal
          title={`Mark "${collectRow.transport}" (${collectRow.lrNo}) as collected`}
          onClose={() => setCollectRow(null)}
          onSubmit={submitCollect}
          submitLabel="Submit"
          submitting={collecting}
        >
          <Field
            field={{ key: "collectedBundle", label: "Collected bundle", type: "number", required: true }}
            value={collectedBundleInput}
            onChange={(_, v) => setCollectedBundleInput(v)}
          />
          {collectError && <div className="cc-error">{collectError}</div>}
        </Modal>
      )}

      {paymentConfirmRow && (
        <ConfirmModal
          title="Change payment status?"
          message={`Are you sure you want to change the payment status to ${
            paymentConfirmRow.paymentStatus === "Paid" ? "Unpaid" : "Paid"
          }?`}
          confirmLabel="Yes, change it"
          submitting={paymentBusyId === paymentConfirmRow.id}
          onConfirm={confirmTogglePayment}
          onCancel={() => setPaymentConfirmRow(null)}
        />
      )}
    </>
  );
}
