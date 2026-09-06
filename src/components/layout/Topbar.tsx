"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { PAGE_TITLES } from "@/utils/navigation";
import { api } from "@/utils/apiClient";
import { Button } from "@/components/ui/Button";

export interface TopbarProps {
  onOpenMenu: () => void;
}

/** Page title/subtitle (looked up from the current route), the mobile menu button, and the signed-in admin's avatar/logout. */
export function Topbar({ onOpenMenu }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    api
      .get<{ email: string }>("/auth/me")
      .then((me) => setEmail(me.email))
      .catch(() => setEmail(""));
  }, []);

  const [title, subtitle] = PAGE_TITLES[pathname] ?? ["", ""];

  const logout = async () => {
    await api.post("/auth/logout").catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="cc-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="cc-menu-btn" onClick={onOpenMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div>
          <div className="cc-topbar-title cc-h">{title}</div>
          <div className="cc-topbar-sub">{subtitle}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {email && <div className="cc-topbar-sub">{email}</div>}
        <div className="cc-avatar" title={email || undefined}>
          {email ? email[0].toUpperCase() : "A"}
        </div>
        <Button variant="ghost" onClick={logout} aria-label="Log out" title="Log out">
          <LogOut size={17} />
        </Button>
      </div>
    </div>
  );
}
