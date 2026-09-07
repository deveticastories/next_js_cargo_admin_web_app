/**
 * Sidebar navigation and page-title config for the Cargo Admin panel.
 *
 * Adding a new screen only requires: a new entry in `NAV`, a matching
 * `[href]: [title, subtitle]` line in `PAGE_TITLES`, and the route folder
 * under `src/app/admin`. `AppShell`/`Sidebar`/`Topbar` read both of these
 * — no other file needs to change.
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, UsersRound, Warehouse, Truck, Bike, Tags,
  ClipboardList, PackagePlus, PackageCheck, Boxes, Ship, ArrowRightLeft,
  FileText, Wallet, Receipt, BarChart3,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Masters",
    items: [
      { href: "/admin/team", label: "Team", icon: Users },
      { href: "/admin/customers", label: "Customers", icon: UsersRound },
      { href: "/admin/stores", label: "Stores", icon: Warehouse },
      { href: "/admin/delivery-partners", label: "Delivery partners", icon: Truck },
      { href: "/admin/pickup-partners", label: "Pickup partners", icon: Bike },
      { href: "/admin/pricing", label: "Pricing", icon: Tags },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/admin/pickup-assign", label: "Pickup assign", icon: ClipboardList },
      { href: "/admin/booking", label: "Booking", icon: PackagePlus },
      { href: "/admin/ready-to-ship", label: "Ready to ship", icon: PackageCheck },
      { href: "/admin/repacking", label: "Repacking", icon: Boxes },
      { href: "/admin/containers", label: "Containers", icon: Ship },
      { href: "/admin/stuffing", label: "Stuffing", icon: ArrowRightLeft },
    ],
  },
  {
    group: "Finance",
    items: [
      { href: "/admin/invoicing", label: "Invoicing", icon: FileText },
      { href: "/admin/credit-note", label: "Credit note", icon: Wallet },
      { href: "/admin/expenses", label: "Daily expense", icon: Receipt },
    ],
  },
  { group: "Reports", items: [{ href: "/admin/reports", label: "Reports", icon: BarChart3 }] },
];

/** "Group / Label" for the topbar breadcrumb, e.g. "Masters / Stores". */
export function getBreadcrumb(pathname: string): string {
  for (const group of NAV) {
    const item = group.items.find((i) => i.href === pathname);
    if (item) return `${group.group} / ${item.label}`;
  }
  return "Cargo Admin";
}

/** `[title, subtitle]` for the page head, keyed by pathname. */
export const PAGE_TITLES: Record<string, [string, string]> = {
  "/admin": ["Dashboard", "A quick look at today's operations"],
  "/admin/team": ["Team", "Admins and employees who use this admin panel"],
  "/admin/customers": ["Customers", "Senders who book shipments and receivers who collect them"],
  "/admin/stores": ["Stores", "Kochi and UAE store locations"],
  "/admin/delivery-partners": ["Delivery partners", "Last-mile delivery vendors at the receiving end"],
  "/admin/pickup-partners": ["Pickup partners", "Third-party partners who collect bundles from senders"],
  "/admin/pricing": ["Pricing", "Route-wise price per unit of measure"],
  "/admin/pickup-assign": ["Pickup assign", "Assign a transport and LR number to a collection run"],
  "/admin/booking": ["Booking", "Create and track shipment bookings"],
  "/admin/ready-to-ship": ["Ready to ship", "Pack bundles and download the shipping list"],
  "/admin/repacking": ["Repacking", "Repack bundles before they move to ready to ship"],
  "/admin/containers": ["Container management", "Track containers moving between Kochi and the UAE"],
  "/admin/stuffing": ["Stuffing", "Load ready-to-ship bookings into a container"],
  "/admin/invoicing": ["Invoicing", "Generate invoices and delivery notes"],
  "/admin/credit-note": ["Credit note", "Petty cash fund, carried forward month to month"],
  "/admin/expenses": ["Daily expense", "Log day-to-day operational spends"],
  "/admin/reports": ["Reports", "Booking activity by month, container, country and customer"],
};
