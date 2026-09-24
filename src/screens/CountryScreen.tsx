"use client";

import { useSearchParams } from "next/navigation";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/**
 * Countries usable as a delivery partner's From/To route endpoints. Lets
 * another screen (e.g. Delivery partners' From/To country search) deep-link
 * straight into "add a new country" — ?new=1&name=<typed text>.
 */
export function CountryScreen() {
  const { countries } = useCargoData();
  const searchParams = useSearchParams();
  const autoOpenNew = searchParams.get("new") === "1";
  const prefillName = searchParams.get("name") ?? "";

  return (
    <MasterView
      title="Country"
      desc="Countries used for delivery partners' From/To routes"
      fields={[{ key: "name", label: "Name", required: true }]}
      columns={[{ key: "name", label: "Name" }]}
      collection={countries}
      autoOpenNew={autoOpenNew}
      initialNewValues={prefillName ? { name: prefillName } : undefined}
    />
  );
}
