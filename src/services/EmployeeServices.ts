/**
 * Team members — cargo-backend's `/employees` module. `role` is a ref to a
 * `/roles` record: populated (`{ _id, roleName, ... }`) on every read, an id
 * on write — the frontend keeps the role's name and resolves it on save.
 */
import type { Employee } from "@/types";
import { ApiError } from "./httpClient";
import { resolveRoleIdByName } from "./RoleServices";
import { createCrudService, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function roleName(ref: unknown, submitted: unknown): string {
  if (ref && typeof ref === "object" && "roleName" in ref) return String((ref as { roleName?: unknown }).roleName ?? "");
  return typeof submitted === "string" ? submitted : "";
}

function toFrontend(doc: BackendDoc, submitted?: Record<string, unknown>): Employee {
  return {
    id: doc._id,
    code: String(doc.empId ?? doc._id),
    name: String(doc.name ?? ""),
    empId: String(doc.empId ?? ""),
    contact: String(doc.contact ?? ""),
    bloodGroup: doc.bloodGroup ? String(doc.bloodGroup) : undefined,
    role: roleName(doc.role, submitted?.role),
    email: doc.email ? String(doc.email) : undefined,
    status: statusToStr(doc.status),
  };
}

async function toBackend(body: Record<string, unknown>) {
  const role = body.role ? await resolveRoleIdByName(String(body.role)) : undefined;
  if (body.role && !role) throw new ApiError(`Role "${String(body.role)}" not found.`, 400);
  const payload: Record<string, unknown> = {
    name: body.name,
    empId: body.empId,
    contact: body.contact,
    bloodGroup: body.bloodGroup || undefined,
    role,
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
