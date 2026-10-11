/**
 * Single source of truth for the cargo-backend API: its base URL and every
 * endpoint path the services in `src/services` call. Paths are relative to
 * `API_BASE_URL` (the backend mounts every module under `/api`, which the
 * base URL already includes). Mirrors the routers in `cargo-backend/app.ts`.
 */

export const API_BASE_URL = "http://3.107.18.59/api";

/** Standard CRUD + status-toggle paths every cargo-backend master module exposes. */
function crudEndpoints<P extends string>(base: P) {
  return {
    BASE: base,
    BY_ID: (id: string) => `${base}/${id}`,
    STATUS: (id: string) => `${base}/${id}/status`,
  } as const;
}

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
  },
  EMPLOYEES: crudEndpoints("/employees"),
  CUSTOMERS: crudEndpoints("/customers"),
  STORES: crudEndpoints("/stores"),
  COUNTRIES: crudEndpoints("/countries"),
  DELIVERY_PARTNERS: crudEndpoints("/delivery-partners"),
  PICKUP_PARTNERS: crudEndpoints("/pickup-partners"),
  PRICING: {
    BASE: "/pricing",
    BY_ID: (id: string) => `/pricing/${id}`,
  },
  FABRICS: crudEndpoints("/fabrics"),
  PRODUCTS: crudEndpoints("/products"),
  PICKUP_ASSIGNS: {
    ...crudEndpoints("/pickup-assigns"),
    PAYMENT_STATUS: (id: string) => `/pickup-assigns/${id}/payment-status`,
    COLLECTED: (id: string) => `/pickup-assigns/${id}/collected`,
  },
  PRE_BOOKINGS: crudEndpoints("/pre-bookings"),
  PACKAGES: {
    BASE: "/packages",
    BY_ID: (id: string) => `/packages/${id}`,
    BY_BOOKING: (bookingId: string) => `/packages/booking/${bookingId}`,
    DOWNLOAD: (id: string) => `/packages/${id}/download`,
  },
  BOOKINGS: {
    ...crudEndpoints("/bookings"),
    PACKAGE_LIST_STATUS: (id: string) => `/bookings/${id}/package-list-status`,
    STUFF_STATUS: (id: string) => `/bookings/${id}/stuff-status`,
  },
  CONTAINERS: crudEndpoints("/containers"),
  STUFFINGS: {
    BASE: "/stuffings",
    BY_ID: (id: string) => `/stuffings/${id}`,
  },
} as const;
