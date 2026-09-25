"use client";

import { useSearchParams } from "next/navigation";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/**
 * Product names used in Repacking and Package ready packing lists. Lets the packing list's Product search deep-link straight into
 * "add a new product" — ?new=1&name=<typed text>.
 */
export function ProductScreen() {
  const { products } = useCargoData();
  const searchParams = useSearchParams();
  const autoOpenNew = searchParams.get("new") === "1";
  const prefillName = searchParams.get("name") ?? "";

  return (
    <MasterView
      title="Product"
      desc="Product names used in Repacking and Package ready packing lists"
      fields={[{ key: "name", label: "Name", required: true }]}
      columns={[{ key: "name", label: "Name" }]}
      collection={products}
      autoOpenNew={autoOpenNew}
      initialNewValues={prefillName ? { name: prefillName } : undefined}
    />
  );
}
