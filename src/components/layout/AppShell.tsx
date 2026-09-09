"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import "@/app/admin/admin.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { api } from "@/utils/apiClient";
import { PAGE_TITLES } from "@/utils/navigation";

/**
 * The admin panel's page frame: sidebar + topbar + page head + scrollable
 * content area. Wraps every route under `/admin` (see
 * `src/app/admin/layout.tsx`). Fetches the signed-in admin's identity once
 * here and hands it down to `Sidebar`, instead of every screen re-fetching it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    api
      .get<{ email: string }>("/auth/me")
      .then((me) => setEmail(me.email))
      .catch(() => setEmail(""));
  }, []);

  const [title, subtitle] = PAGE_TITLES[pathname] ?? ["", ""];

  return (
    <div className="cc-root">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} email={email} />
      <div className="cc-main">
        <Topbar onOpenMenu={() => setSidebarOpen(true)} />
        {/* Keyed by route so `.cc-content`'s entrance animation (see admin.css) replays on
            every navigation, instead of only once on first page load. */}
        <div className="cc-content" key={pathname}>
          <div className="cc-page-head">
            <div>
              <div className="cc-page-title cc-h">{title}</div>
              <div className="cc-page-sub">{subtitle}</div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
