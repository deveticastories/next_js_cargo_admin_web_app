"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, RotateCw } from "lucide-react";
import { getBreadcrumb } from "@/utils/navigation";
import { logout as logoutSession } from "@/services/AuthenticationServices";
import { Button } from "@/components/ui/Button";
import { refreshCargoData } from "@/components/providers/CargoDataProvider";

export interface TopbarProps {
  onOpenMenu: () => void;
}

const stampFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Slim utility bar: breadcrumb, a "last updated" stamp, refresh, and logout. Identity lives in the sidebar footer. */
export function Topbar({ onOpenMenu }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [stamp, setStamp] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Computed client-side only (avoids a server/client render mismatch on
    // the timestamp) — deferred a tick so the setState lands in its own
    // microtask rather than synchronously inside the effect body.
    queueMicrotask(() => setStamp(stampFormat.format(new Date())));
  }, [pathname]);

  const refresh = async () => {
    setRefreshing(true);
    router.refresh();
    try {
      await refreshCargoData();
      setStamp(stampFormat.format(new Date()));
    } finally {
      setRefreshing(false);
    }
  };

  const logout = () => {
    // cargo-backend's JWT is stateless and has no `/auth/logout` endpoint —
    // signing out just means dropping the token locally.
    logoutSession();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="cc-topbar">
      <button className="cc-menu-btn" onClick={onOpenMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <div className="cc-topbar-crumb">{getBreadcrumb(pathname)}</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {stamp && <span className="cc-topbar-stamp">Updated {stamp}</span>}
        <Button size="sm" onClick={refresh} loading={refreshing}>
          <RotateCw size={14} /> Refresh
        </Button>
        <Button size="sm" onClick={logout} style={{ color: "var(--danger)" }}>
          <LogOut size={14} /> Log out
        </Button>
      </div>
    </div>
  );
}
