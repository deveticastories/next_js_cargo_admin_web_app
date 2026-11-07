import { Ship } from "lucide-react";
import type { Booking, Receiver, Sender } from "@/types";

/**
 * "Location, Country" for either end of a booking — from the booking's populated customer,
 * falling back to the Senders/Receivers lists (e.g. right after a save).
 */
export function bookingPlace(
  b: Booking,
  side: "sender" | "receiver",
  senders: Sender[],
  receivers: Receiver[],
): string {
  if (side === "sender") {
    const s = senders.find((c) => c.name === b.sender);
    return [b.senderLocation || s?.location, b.senderCountry].filter(Boolean).join(", ");
  }
  const r = receivers.find((c) => c.name === b.receiver);
  return [b.receiverLocation || r?.location, b.receiverCountry || r?.country].filter(Boolean).join(", ");
}

/** Sender → receiver with the from/to places highlighted, like the mobile app's booking card. */
export function BookingRoute({
  booking,
  senders,
  receivers,
}: {
  booking: Booking;
  senders: Sender[];
  receivers: Receiver[];
}) {
  return (
    <div className="cc-route">
      <div className="cc-route-end">
        <span className="cc-route-name">{booking.sender || "—"}</span>
        <span className="cc-route-place cc-route-from">
          {bookingPlace(booking, "sender", senders, receivers) || "—"}
        </span>
      </div>
      <span className="cc-route-line" aria-hidden>
        <Ship size={14} />
      </span>
      <div className="cc-route-end">
        <span className="cc-route-name">{booking.receiver || "—"}</span>
        <span className="cc-route-place cc-route-to">
          {bookingPlace(booking, "receiver", senders, receivers) || "—"}
        </span>
      </div>
    </div>
  );
}
