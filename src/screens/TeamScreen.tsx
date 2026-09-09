"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";

/**
 * Admins and employees who use this admin panel. Email + password here are
 * this team member's own login credentials (`POST /api/auth/login` accepts
 * either an `Admin` or an `Employee` account) — not just a directory entry.
 * The password field is intentionally not `required`: on create the API
 * rejects a missing one, but on edit a blank value means "keep the current
 * password" (see `src/app/api/employees/[id]/route.ts`).
 */
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
        { key: "email", label: "Login email", type: "email", required: true },
        {
          key: "password",
          label: "Password",
          type: "password",
          placeholder: "Leave blank to keep current password",
        },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "empId", label: "Employee ID" },
        { key: "contact", label: "Contact" },
        { key: "bloodGroup", label: "Blood group" },
        { key: "email", label: "Login email" },
        { key: "role", label: "Role" },
      ]}
      collection={employees}
    />
  );
}
