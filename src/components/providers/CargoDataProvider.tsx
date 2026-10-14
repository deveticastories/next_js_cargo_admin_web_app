"use client";

/**
 * Gives every screen access to the app's data, each collection backed by a
 * module-level store (see `createCollectionStore`). A screen reads
 * `useCargoData().bookings.items` and calls `.create()`/`.update()`/`.remove()`
 * — those write through to cargo-backend and update the shared list.
 *
 * Collections load lazily: only the ones a screen actually reads off
 * `useCargoData()` are fetched, so opening e.g. the Country screen costs one
 * request instead of every list in the app. Lists are also cached (in memory
 * and in localStorage) and re-validated in the background once stale, so
 * revisiting a screen or reloading the page shows data immediately.
 */

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import type {
  Booking,
  Container,
  Country,
  CreditNoteEntry,
  DailyExpense,
  DeliveryPartner,
  Employee,
  Fabric,
  Invoice,
  PickupAssign,
  PickupPartner,
  PreBooking,
  PricingRoute,
  Product,
  ReceiptEntry,
  Receiver,
  Sender,
  Store,
  Stuffing,
  UaeStoreLogEntry,
} from "@/types";
import { createCollectionStore, type ApiCollection, type CollectionStore } from "@/utils/useApiCollection";
import { EmployeeServices } from "@/services/EmployeeServices";
import { SenderServices, ReceiverServices } from "@/services/CustomerServices";
import { StoreServices } from "@/services/StoreServices";
import { CountryServices } from "@/services/CountryServices";
import { ProductServices } from "@/services/ProductServices";
import { FabricServices } from "@/services/FabricServices";
import { DeliveryPartnerServices } from "@/services/DeliveryPartnerServices";
import { PickupPartnerServices } from "@/services/PickupPartnerServices";
import { PricingServices } from "@/services/PricingServices";
import { PickupAssignServices } from "@/services/PickupAssignServices";
import { PreBookingServices } from "@/services/PreBookingServices";
import { ContainerServices } from "@/services/ContainerServices";
import { BookingServices } from "@/services/BookingServices";
import { StuffingServices } from "@/services/StuffingServices";
import { InvoiceServices } from "@/services/InvoiceServices";
import { CreditNoteServices } from "@/services/CreditNoteServices";
import { DailyExpenseServices } from "@/services/DailyExpenseServices";
import { ReceiptEntryServices } from "@/services/ReceiptEntryServices";
import { UaeStoreLogLocalServices } from "@/services/LocalWorkflowServices";

export interface CargoData {
  employees: ApiCollection<Employee>;
  senders: ApiCollection<Sender>;
  receivers: ApiCollection<Receiver>;
  stores: ApiCollection<Store>;
  countries: ApiCollection<Country>;
  products: ApiCollection<Product>;
  fabrics: ApiCollection<Fabric>;
  deliveryPartners: ApiCollection<DeliveryPartner>;
  pickupPartners: ApiCollection<PickupPartner>;
  pricing: ApiCollection<PricingRoute>;
  pickupAssigns: ApiCollection<PickupAssign>;
  bookings: ApiCollection<Booking>;
  preBookings: ApiCollection<PreBooking>;
  containers: ApiCollection<Container>;
  dailyExpenses: ApiCollection<DailyExpense>;
  invoices: ApiCollection<Invoice>;
  receiptEntries: ApiCollection<ReceiptEntry>;
  creditNotes: ApiCollection<CreditNoteEntry>;
  stuffings: ApiCollection<Stuffing>;
  uaeStoreLog: ApiCollection<UaeStoreLogEntry>;
}

type ItemOf<C> = C extends ApiCollection<infer T> ? T : never;

const STORES: { [K in keyof CargoData]: CollectionStore<ItemOf<CargoData[K]>> } = {
  // Master-data entities — live against cargo-backend (see src/services).
  employees: createCollectionStore(EmployeeServices, { persistKey: "employees" }),
  senders: createCollectionStore(SenderServices, { persistKey: "senders" }),
  receivers: createCollectionStore(ReceiverServices, { persistKey: "receivers" }),
  stores: createCollectionStore(StoreServices, { persistKey: "stores" }),
  countries: createCollectionStore(CountryServices, { persistKey: "countries" }),
  products: createCollectionStore(ProductServices, { persistKey: "products" }),
  fabrics: createCollectionStore(FabricServices, { persistKey: "fabrics" }),
  deliveryPartners: createCollectionStore(DeliveryPartnerServices, { persistKey: "deliveryPartners" }),
  pickupPartners: createCollectionStore(PickupPartnerServices, { persistKey: "pickupPartners" }),
  pricing: createCollectionStore(PricingServices, { persistKey: "pricing" }),
  pickupAssigns: createCollectionStore(PickupAssignServices, { persistKey: "pickupAssigns" }),
  preBookings: createCollectionStore(PreBookingServices, { persistKey: "preBookings" }),
  containers: createCollectionStore(ContainerServices, { persistKey: "containers" }),
  bookings: createCollectionStore(BookingServices, { persistKey: "bookings" }),
  stuffings: createCollectionStore(StuffingServices, { persistKey: "stuffings" }),
  dailyExpenses: createCollectionStore(DailyExpenseServices, { persistKey: "dailyExpenses" }),
  invoices: createCollectionStore(InvoiceServices, { persistKey: "invoices" }),
  receiptEntries: createCollectionStore(ReceiptEntryServices, { persistKey: "receiptEntries" }),
  creditNotes: createCollectionStore(CreditNoteServices, { persistKey: "creditNotes" }),
  // cargo-backend has no module for this yet (see
  // src/services/LocalWorkflowServices.ts) — fully usable, but not
  // persisted server-side.
  uaeStoreLog: createCollectionStore(UaeStoreLogLocalServices),
};

const KEYS = Object.keys(STORES) as (keyof CargoData)[];

function subscribeAll(listener: () => void): () => void {
  const unsubscribes = KEYS.map((key) => STORES[key].subscribe(listener));
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

// `useSyncExternalStore` needs the same object back until something changes.
let combined: CargoData | null = null;
function getCombined(): CargoData {
  if (combined && KEYS.every((key) => combined![key] === STORES[key].getSnapshot())) return combined;
  combined = Object.fromEntries(KEYS.map((key) => [key, STORES[key].getSnapshot()])) as unknown as CargoData;
  return combined;
}

let serverCombined: CargoData | null = null;
function getServerCombined(): CargoData {
  serverCombined ??= Object.fromEntries(KEYS.map((key) => [key, STORES[key].getServerSnapshot()])) as unknown as CargoData;
  return serverCombined;
}

/** Every collection's current state, without marking any of them as needed. */
function useAllCollections(): CargoData {
  return useSyncExternalStore(subscribeAll, getCombined, getServerCombined);
}

/** Kept so the admin layout has one place to wrap — the data itself lives in module-level stores. */
export function CargoDataProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Access shared admin panel data. Reading a collection off the result
 * (`const { bookings } = useCargoData()`) is what makes it load.
 */
export function useCargoData(): CargoData {
  const data = useAllCollections();
  return useMemo(
    () =>
      new Proxy(data, {
        get(target, prop, receiver) {
          if (typeof prop === "string" && prop in STORES) STORES[prop as keyof CargoData].request();
          return Reflect.get(target, prop, receiver);
        },
      }),
    [data]
  );
}

/** For status UI (e.g. the data banner): sees every collection without triggering any loads. */
export function useCargoDataStatus(): CargoData {
  return useAllCollections();
}

/** Re-fetches every collection a screen has used so far this session. */
export async function refreshCargoData(): Promise<void> {
  await Promise.all(KEYS.filter((key) => STORES[key].requested).map((key) => STORES[key].refetch()));
}
