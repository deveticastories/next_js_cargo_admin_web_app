"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";
import { Button } from "@/components/ui/Button";

/** Senders (who book shipments) and receivers (who collect them), as two tabs. */
export function CustomersScreen() {
  const { senders, receivers } = useCargoData();
  // Lets another screen (e.g. Pre-booking's Sender search) deep-link straight into
  // "add a new sender" — ?tab=sender&newSender=1&senderName=<typed text>.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"sender" | "receiver">(searchParams.get("tab") === "receiver" ? "receiver" : "sender");
  const autoOpenNewSender = tab === "sender" && searchParams.get("newSender") === "1";
  const prefillSenderName = searchParams.get("senderName") ?? "";
  const autoOpenNewReceiver = tab === "receiver" && searchParams.get("newReceiver") === "1";
  const prefillReceiverName = searchParams.get("receiverName") ?? "";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Button variant={tab === "sender" ? "primary" : "default"} onClick={() => setTab("sender")}>
          Senders
        </Button>
        <Button variant={tab === "receiver" ? "primary" : "default"} onClick={() => setTab("receiver")}>
          Receivers
        </Button>
      </div>

      {tab === "sender" ? (
        <MasterView
          title="Senders"
          desc="People or businesses who book shipments"
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "whatsapp", label: "WhatsApp number", required: true },
            { key: "location", label: "Location", required: true },
          ]}
          columns={[
            { key: "name", label: "Name" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "location", label: "Location" },
          ]}
          collection={senders}
          autoOpenNew={autoOpenNewSender}
          initialNewValues={prefillSenderName ? { name: prefillSenderName } : undefined}
        />
      ) : (
        <MasterView
          title="Receivers"
          desc="People who collect shipments at the destination"
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "whatsapp", label: "WhatsApp number", required: true },
            { key: "country", label: "Country", required: true },
            { key: "location", label: "Location", required: true },
            { key: "discount", label: "Discount (%)", type: "number" },
          ]}
          columns={[
            { key: "name", label: "Name" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "country", label: "Country" },
            { key: "location", label: "Location" },
            { key: "discount", label: "Discount", render: (r) => `${r.discount || 0}%` },
          ]}
          collection={receivers}
          autoOpenNew={autoOpenNewReceiver}
          initialNewValues={prefillReceiverName ? { name: prefillReceiverName } : undefined}
        />
      )}
    </div>
  );
}
