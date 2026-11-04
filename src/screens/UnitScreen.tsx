"use client";

import { useSearchParams } from "next/navigation";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/**
 * Units of measure (e.g. Kilogram, Piece) picked on packing-list product lines. Lets the packing list's Unit search
 * deep-link straight into "add a new unit" — ?new=1&name=<typed text>.
 */
export function UnitScreen() {
  const { units } = useCargoData();
  const searchParams = useSearchParams();
  const autoOpenNew = searchParams.get("new") === "1";
  const prefillName = searchParams.get("name") ?? "";

  return (
    <MasterView
      title="Unit"
      desc="Units of measure used on packing-list product lines"
      fields={[{ key: "name", label: "Name", required: true }]}
      columns={[{ key: "name", label: "Name" }]}
      collection={units}
      autoOpenNew={autoOpenNew}
      initialNewValues={prefillName ? { name: prefillName } : undefined}
    />
  );
}
