"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { BundleWorkspace } from "@/components/shared/BundleWorkspace";

/** Repack a bundle, then move the booking on to Ready to ship. */
export function RepackingScreen() {
  const { bookings } = useCargoData();
  return <BundleWorkspace mode="repack" bookings={bookings} />;
}
