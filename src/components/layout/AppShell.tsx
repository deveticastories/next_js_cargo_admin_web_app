"use client";

import { useState, type ReactNode } from "react";
import "@/app/admin/admin.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

/**
 * The admin panel's page frame: sidebar + topbar + scrollable content area.
 * Wraps every route under `/admin` (see `src/app/admin/layout.tsx`).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="cc-root">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="cc-main">
        <Topbar onOpenMenu={() => setSidebarOpen(true)} />
        <div className="cc-content">{children}</div>
      </div>
    </div>
  );
}
