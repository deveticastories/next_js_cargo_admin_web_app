"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";
import { money } from "@/utils/format";

/** Last-mile delivery vendors at the receiving end. */
export function DeliveryPartnersScreen() {
  const { deliveryPartners } = useCargoData();

  return (
    <MasterView
      title="Delivery partners"
      desc="Last-mile delivery vendors"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "whatsapp", label: "WhatsApp number", required: true },
        { key: "from", label: "From" },
        { key: "toCountry", label: "To country" },
        { key: "charge", label: "Delivery charge", type: "number" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "whatsapp", label: "WhatsApp" },
        { key: "from", label: "From" },
        { key: "toCountry", label: "To country" },
        { key: "charge", label: "Charge", render: (r) => money(r.charge) },
      ]}
      collection={deliveryPartners}
    />
  );
}
