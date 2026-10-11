/** Team members (Admin/Employee accounts) — cargo-backend's `/employees` module. */
import type { Employee } from "@/types";
import { createCrudService, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): Employee {
  return {
    id: doc._id,
    code: String(doc.empId ?? doc._id),
    name: String(doc.name ?? ""),
    empId: String(doc.empId ?? ""),
    contact: String(doc.contact ?? ""),
    bloodGroup: doc.bloodGroup ? String(doc.bloodGroup) : undefined,
    role: (doc.role as Employee["role"]) ?? "",
    email: doc.email ? String(doc.email) : undefined,
    status: statusToStr(doc.status),
  };
}

function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    name: body.name,
    empId: body.empId,
    contact: body.contact,
    bloodGroup: body.bloodGroup || undefined,
    role: body.role,
    email: body.email,
  };
  // Blank password on edit means "keep the current password" — never send an empty string.
  if (body.password) payload.password = body.password;
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

export const EmployeeServices: EntityService<Employee> = createCrudService<Employee>({
  basePath: API_ENDPOINTS.EMPLOYEES.BASE,
  listKey: "employees",
  itemKey: "employee",
  toFrontend,
  toBackend,
});
