"use client";

import { useState } from "react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";
import { Button } from "@/components/ui/Button";

/** Senders (who book shipments) and receivers (who collect them), as two tabs. */
export function CustomersScreen() {
  const { senders, receivers } = useCargoData();
  const [tab, setTab] = useState<"sender" | "receiver">("sender");

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
        />
      )}
    </div>
  );
}
