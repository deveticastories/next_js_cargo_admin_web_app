/**
 * Shared TypeScript types for the Cargo Admin panel.
 *
 * These mirror what the backend (`src/backend/models`) actually returns —
 * `id` is the Mongo document id (used for edit/delete API calls); `code`
 * is the human-readable display id (e.g. "SND-0001") the backend
 * auto-generates for most entities (see `withCode` in
 * `src/backend/utils/generateCode.ts`). Screens display `code`, never `id`.
 */

export type Status = "Active" | "Inactive";

export type BillOption = "With Bill" | "Without Bill";

export type RepackingStatus = "Ready to Ship" | "Repacking Required";

export type PaymentType = "Cash" | "UPI";

export type EmployeeRole = "Admin" | "Employee";

/** Common fields shared by most master-data records. */
export interface BaseRecord {
  id: string;
  code: string;
  status?: Status;
}

export interface Employee extends BaseRecord {
  name: string;
  empId: string;
  contact: string;
  bloodGroup?: string;
  role: EmployeeRole | "";
}

export interface Sender extends BaseRecord {
  name: string;
  whatsapp: string;
  location: string;
}

export interface Receiver extends BaseRecord {
  name: string;
  whatsapp: string;
  country: string;
  location: string;
  discount?: string;
}

export interface Store extends BaseRecord {
  location: string;
  contact: string;
  inCharge: string;
}

export interface DeliveryPartner extends BaseRecord {
  name: string;
  whatsapp: string;
  from?: string;
  toCountry?: string;
  charge?: string;
}

export interface PickupPartner extends BaseRecord {
  name: string;
  whatsapp: string;
}

/** Route-wise price per unit of measure. Mirrors `PricingRoute` in the backend. No active/inactive status. */
export interface PricingRoute {
  id: string;
  code: string;
  from: string;
  to: string;
  uom: string;
  price: string;
}

export interface PickupAssign extends BaseRecord {
  transport: string;
  lrNo: string;
}

export interface Booking extends BaseRecord {
  sender: string;
  receiver: string;
  pickupOption: string;
  date: string;
  billOption: BillOption | "";
  bundleCount: number;
  repackingStatus: RepackingStatus | "";
  stuffed: boolean;
}

export interface Container extends BaseRecord {
  company: string;
  stuffingDate: string;
  cutOffDate?: string;
  etaCok?: string;
  etdCok?: string;
  etaUae?: string;
}

/** A single day-to-day operational spend. Mirrors `DailyExpense` in the backend. No active/inactive status. */
export interface DailyExpense {
  id: string;
  code: string;
  date: string;
  type: string;
  paymentType: PaymentType | "";
  amount: number;
  description?: string;
}

/** One petty-cash fund entry. Balance carries forward automatically. */
export interface CreditNoteEntry {
  id: string;
  code: string;
  date: string;
  amount: number;
  description?: string;
}

/** One row of a booking's packing list (ready-to-ship / repacking). */
export interface BundleLineItem {
  netWeight: string;
  grossWeight: string;
  product: string;
  qty: string;
  fabric: string;
  description: string;
}

/** A booking's packing list for one bundle. Mirrors the `PackingList` backend model. */
export interface PackingList {
  id: string;
  booking: string;
  bundleNumber: number;
  items: BundleLineItem[];
}

/** One "load these bookings into this container" event. Mirrors `Stuffing` in the backend. */
export interface Stuffing {
  id: string;
  code: string;
  container: string;
  bookings: string[];
  date: string;
}

/** One booking that has arrived at the UAE store after stuffing. Mirrors `UaeStoreLog` in the backend. */
export interface UaeStoreLogEntry {
  id: string;
  booking: string;
  receiver: string;
  bundles: number;
  stuffing: string;
  date: string;
}

/* ---------------------------------------------------------------------- */
/* Generic UI config types (used by Field, DataTable, MasterView)          */
/* ---------------------------------------------------------------------- */

export type FieldType = "text" | "email" | "password" | "number" | "date" | "select" | "textarea";

export interface FieldConfig {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  required?: boolean;
}

export interface ColumnConfig<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

/** Any record that can be listed/edited by the generic MasterView screen. */
export interface RecordWithId {
  id: string;
}
