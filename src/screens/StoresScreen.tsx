"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/** Kochi and UAE store (warehouse) locations. */
export function StoresScreen() {
  const { stores } = useCargoData();

  return (
    <MasterView
      title="Stores"
      desc="Warehouse locations"
      fields={[
        { key: "location", label: "Location", required: true },
        { key: "contact", label: "Contact number", required: true },
        { key: "inCharge", label: "Store in charge", required: true },
      ]}
      columns={[
        { key: "code", label: "Store ID" },
        { key: "location", label: "Location" },
        { key: "contact", label: "Contact" },
        { key: "inCharge", label: "In charge" },
      ]}
      collection={stores}
    />
  );
}
