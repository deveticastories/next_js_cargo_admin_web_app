"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";
import { Badge } from "@/components/ui/Badge";

/** Assign a transport (delivery partner) and LR number to a collection run. */
export function PickupAssignScreen() {
  const { pickupAssigns, deliveryPartners } = useCargoData();

  return (
    <MasterView
      title="Pickup assign"
      desc="Assign a transport to a collection run"
      fields={[
        {
          key: "transport",
          label: "Choose transport",
          type: "select",
          options: deliveryPartners.items.map((d) => d.name),
          required: true,
        },
        { key: "lrNo", label: "LR number", required: true },
        { key: "bundleCount", label: "Number of bundles", type: "number", required: true },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "paymentStatus", label: "Payment status", type: "select", options: ["Unpaid", "Paid"], required: true },
        { key: "pickupStatus", label: "Pickup status", type: "select", options: ["Pending", "Collected"], required: true },
      ]}
      columns={[
        { key: "transport", label: "Transport" },
        { key: "lrNo", label: "LR No" },
        { key: "bundleCount", label: "Bundles" },
        { key: "amount", label: "Amount", render: (r) => r.amount || 0 },
        { key: "paymentStatus", label: "Payment", render: (r) => <Badge value={r.paymentStatus} /> },
        { key: "pickupStatus", label: "Pickup status", render: (r) => <Badge value={r.pickupStatus} /> },
      ]}
      collection={pickupAssigns}
      initialNewValues={{ paymentStatus: "Unpaid", pickupStatus: "Pending" }}
    />
  );
}
