"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import "@/app/admin/admin.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DataStatusBanner } from "@/components/shared/DataStatusBanner";
import { getCurrentUser } from "@/services/AuthenticationServices";
import { PAGE_TITLES } from "@/utils/navigation";
import { useSessionExpiry } from "@/utils/useSessionExpiry";

/**
 * The admin panel's page frame: sidebar + topbar + page head + scrollable
 * content area. Wraps every route under `/admin` (see
 * `src/app/admin/layout.tsx`). cargo-backend has no `/auth/me` endpoint, so
 * the signed-in admin's identity is read back from what login cached
 * locally (see `AuthenticationServices`) instead of a network call.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState("");
  useSessionExpiry();

  useEffect(() => {
    // Deferred a tick so the setState lands in its own microtask rather than
    // synchronously inside the effect body (same pattern as `useApiCollection`).
    queueMicrotask(() => setEmail(getCurrentUser()?.email ?? ""));
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
          <DataStatusBanner />
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
