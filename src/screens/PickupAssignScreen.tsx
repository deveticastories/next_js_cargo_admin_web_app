"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/** Assign a transport (pickup or delivery partner) and LR number to a collection run. */
export function PickupAssignScreen() {
  const { pickupAssigns, pickupPartners, deliveryPartners } = useCargoData();

  return (
    <MasterView
      title="Pickup assign"
      desc="Assign a transport to a collection run"
      fields={[
        {
          key: "transport",
          label: "Choose transport",
          type: "select",
          options: [...pickupPartners.items.map((p) => p.name), ...deliveryPartners.items.map((d) => d.name)],
          required: true,
        },
        { key: "lrNo", label: "LR number", required: true },
      ]}
      columns={[
        { key: "transport", label: "Transport" },
        { key: "lrNo", label: "LR No" },
      ]}
      collection={pickupAssigns}
    />
  );
}
