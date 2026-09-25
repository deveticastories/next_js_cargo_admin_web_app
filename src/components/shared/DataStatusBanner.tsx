"use client";

import { useEffect, useState } from "react";
import { useCargoData, type CargoData } from "@/components/providers/CargoDataProvider";
import { Button } from "@/components/ui/Button";

/** Human names for each collection, used in the banner's "Couldn't load …" message. */
const LABELS: Record<keyof CargoData, string> = {
  employees: "team",
  senders: "senders",
  receivers: "receivers",
  stores: "stores",
  countries: "countries",
  products: "products",
  fabrics: "fabrics",
  deliveryPartners: "delivery partners",
  pickupPartners: "pickup partners",
  pricing: "pricing",
  pickupAssigns: "pickup assignments",
  bookings: "bookings",
  preBookings: "pre-bookings",
  containers: "containers",
  dailyExpenses: "expenses",
  invoices: "invoices",
  receiptEntries: "receipts",
  creditNotes: "credit notes",
  stuffings: "stuffings",
  uaeStoreLog: "UAE store log",
};

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * One place, above every admin screen, that tells the user when data isn't
 * loading properly: offline, a load that's taking unusually long, or loads
 * that failed (after the API client's own automatic retries) — with a Retry
 * button that reloads just the failed ones. Each screen still keeps showing
 * whatever data it already had.
 */
export function DataStatusBanner() {
  const data = useCargoData();
  const online = useOnline();
  const [retrying, setRetrying] = useState(false);

  const entries = Object.entries(data) as [keyof CargoData, CargoData[keyof CargoData]][];
  const failed = entries.filter(([, c]) => c.error && !c.loading);
  const slow = entries.some(([, c]) => c.slow);

  const retryFailed = async () => {
    setRetrying(true);
    await Promise.all(failed.map(([, c]) => c.refetch()));
    setRetrying(false);
  };

  if (!online) {
    return (
      <div className="cc-alert-error cc-data-banner" role="alert">
        <span>You&apos;re offline. Changes can&apos;t be saved until your connection is back — data will reload automatically.</span>
      </div>
    );
  }

  if (failed.length > 0) {
    const names = failed.map(([key]) => LABELS[key]);
    const shown = names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ");
    return (
      <div className="cc-alert-error cc-data-banner" role="alert">
        <span>
          Couldn&apos;t load {shown}. {failed[0][1].error}
        </span>
        <Button size="sm" onClick={retryFailed} loading={retrying}>
          Retry
        </Button>
      </div>
    );
  }

  if (slow) {
    return (
      <div className="cc-alert-warn cc-data-banner" role="status">
        <span className="cc-btn-spinner" aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>Loading is taking longer than usual — hang tight, still working on it…</span>
      </div>
    );
  }

  return null;
}
