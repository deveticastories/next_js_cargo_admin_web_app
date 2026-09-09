"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";
import { money } from "@/utils/format";

/** Route-wise price per unit of measure. */
export function PricingScreen() {
  const { pricing } = useCargoData();

  return (
    <MasterView
      title="Pricing"
      desc="Route-wise price per unit"
      hasStatus={false}
      fields={[
        { key: "from", label: "From", required: true },
        { key: "to", label: "To", required: true },
        { key: "uom", label: "Unit of measure", type: "select", options: ["Bundle", "Box", "CBM", "KG"], required: true },
        { key: "price", label: "Price", type: "number", required: true },
      ]}
      columns={[
        { key: "from", label: "From" },
        { key: "to", label: "To" },
        { key: "uom", label: "UOM" },
        { key: "price", label: "Price", render: (r) => money(r.price) },
      ]}
      collection={pricing}
    />
  );
}
