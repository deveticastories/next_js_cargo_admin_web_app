"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { BundleWorkspace } from "@/components/shared/BundleWorkspace";

/** Build the packing list for a bundle and download the ready-to-ship list. */
export function ReadyToShipScreen() {
  const { bookings } = useCargoData();
  return <BundleWorkspace mode="ready" bookings={bookings} />;
}
