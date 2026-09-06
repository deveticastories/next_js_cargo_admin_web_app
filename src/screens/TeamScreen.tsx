"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/** Admins and employees who use this admin panel. */
export function TeamScreen() {
  const { employees } = useCargoData();

  return (
    <MasterView
      title="Team"
      desc="Admins and employees"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "empId", label: "Employee ID", required: true },
        { key: "contact", label: "Contact number", required: true },
        { key: "bloodGroup", label: "Blood group" },
        { key: "role", label: "Role", type: "select", options: ["Admin", "Employee"], required: true },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "empId", label: "Employee ID" },
        { key: "contact", label: "Contact" },
        { key: "bloodGroup", label: "Blood group" },
        { key: "role", label: "Role" },
      ]}
      collection={employees}
    />
  );
}
