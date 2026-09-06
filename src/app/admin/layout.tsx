import type { ReactNode } from "react";
import { CargoDataProvider } from "@/components/providers/CargoDataProvider";
import { AppShell } from "@/components/layout/AppShell";

/** Shared shell + data provider for every screen under /admin. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <CargoDataProvider>
      <AppShell>{children}</AppShell>
    </CargoDataProvider>
  );
}
