"use client";

import { useSearchParams } from "next/navigation";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/**
 * Fabrics used in Repacking and Package ready packing lists. Lets the packing list's Fabric search deep-link straight into
 * "add a new fabric" — ?new=1&name=<typed text>.
 */
export function FabricScreen() {
  const { fabrics } = useCargoData();
  const searchParams = useSearchParams();
  const autoOpenNew = searchParams.get("new") === "1";
  const prefillName = searchParams.get("name") ?? "";

  return (
    <MasterView
      title="Fabric"
      desc="Fabrics used in Repacking and Package ready packing lists"
      fields={[{ key: "name", label: "Name", required: true }]}
      columns={[{ key: "name", label: "Name" }]}
      collection={fabrics}
      autoOpenNew={autoOpenNew}
      initialNewValues={prefillName ? { name: prefillName } : undefined}
    />
  );
}
