"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";
import { fmtDate } from "@/utils/format";

/** Containers moving between Kochi and the UAE. */
export function ContainersScreen() {
  const { containers } = useCargoData();

  return (
    <MasterView
      title="Containers"
      desc="Containers moving between Kochi and the UAE"
      fields={[
        { key: "company", label: "Shipping line / company", required: true },
        { key: "stuffingDate", label: "Stuffing date", type: "date", required: true },
        { key: "cutOffDate", label: "Cut-off date", type: "date" },
        { key: "etaCok", label: "ETA Kochi", type: "date" },
        { key: "etdCok", label: "ETD Kochi", type: "date" },
        { key: "etaUae", label: "ETA UAE", type: "date" },
      ]}
      columns={[
        { key: "company", label: "Company" },
        { key: "stuffingDate", label: "Stuffing", render: (r) => fmtDate(r.stuffingDate) },
        { key: "cutOffDate", label: "Cut-off", render: (r) => fmtDate(r.cutOffDate) },
        { key: "etaCok", label: "ETA COK", render: (r) => fmtDate(r.etaCok) },
        { key: "etdCok", label: "ETD COK", render: (r) => fmtDate(r.etdCok) },
        { key: "etaUae", label: "ETA UAE", render: (r) => fmtDate(r.etaUae) },
      ]}
      collection={containers}
    />
  );
}
