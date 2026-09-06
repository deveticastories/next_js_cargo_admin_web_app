"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/** Third-party partners who collect bundles from senders. */
export function PickupPartnersScreen() {
  const { pickupPartners } = useCargoData();

  return (
    <MasterView
      title="Pickup partners"
      desc="Third-party collection partners"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "whatsapp", label: "WhatsApp number", required: true },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "whatsapp", label: "WhatsApp" },
      ]}
      collection={pickupPartners}
    />
  );
}
