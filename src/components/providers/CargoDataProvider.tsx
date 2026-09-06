"use client";

/**
 * Gives every screen access to the app's data, each collection backed by a
 * real API call (see `useApiCollection`) instead of in-memory mock state.
 * A screen reads `useCargoData().bookings.items` and calls
 * `.create()`/`.update()`/`.remove()` — those write through to MongoDB via
 * `/api/bookings` and update local state from the server's response.
 */

import { createContext, useContext, type ReactNode } from "react";
import type {
  Booking,
  Container,
  CreditNoteEntry,
  DailyExpense,
  DeliveryPartner,
  Employee,
  PickupAssign,
  PickupPartner,
  PricingRoute,
  Receiver,
  Sender,
  Store,
  Stuffing,
  UaeStoreLogEntry,
} from "@/types";
import { useApiCollection, type ApiCollection } from "@/utils/useApiCollection";

export interface CargoData {
  employees: ApiCollection<Employee>;
  senders: ApiCollection<Sender>;
  receivers: ApiCollection<Receiver>;
  stores: ApiCollection<Store>;
  deliveryPartners: ApiCollection<DeliveryPartner>;
  pickupPartners: ApiCollection<PickupPartner>;
  pricing: ApiCollection<PricingRoute>;
  pickupAssigns: ApiCollection<PickupAssign>;
  bookings: ApiCollection<Booking>;
  containers: ApiCollection<Container>;
  dailyExpenses: ApiCollection<DailyExpense>;
  creditNotes: ApiCollection<CreditNoteEntry>;
  stuffings: ApiCollection<Stuffing>;
  uaeStoreLog: ApiCollection<UaeStoreLogEntry>;
}

const CargoDataContext = createContext<CargoData | null>(null);

export function CargoDataProvider({ children }: { children: ReactNode }) {
  const value: CargoData = {
    employees: useApiCollection<Employee>("/employees"),
    senders: useApiCollection<Sender>("/senders"),
    receivers: useApiCollection<Receiver>("/receivers"),
    stores: useApiCollection<Store>("/stores"),
    deliveryPartners: useApiCollection<DeliveryPartner>("/delivery-partners"),
    pickupPartners: useApiCollection<PickupPartner>("/pickup-partners"),
    pricing: useApiCollection<PricingRoute>("/pricing"),
    pickupAssigns: useApiCollection<PickupAssign>("/pickup-assigns"),
    bookings: useApiCollection<Booking>("/bookings"),
    containers: useApiCollection<Container>("/containers"),
    dailyExpenses: useApiCollection<DailyExpense>("/expenses"),
    creditNotes: useApiCollection<CreditNoteEntry>("/credit-notes"),
    stuffings: useApiCollection<Stuffing>("/stuffings"),
    uaeStoreLog: useApiCollection<UaeStoreLogEntry>("/uae-store-log"),
  };

  return <CargoDataContext.Provider value={value}>{children}</CargoDataContext.Provider>;
}

/** Access shared admin panel data. Must be used inside `CargoDataProvider`. */
export function useCargoData(): CargoData {
  const ctx = useContext(CargoDataContext);
  if (!ctx) throw new Error("useCargoData must be used inside <CargoDataProvider>");
  return ctx;
}
