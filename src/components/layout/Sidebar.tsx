"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { NAV } from "@/utils/navigation";
import logoLight from "@/assets/images/logo-light.png";

export interface SidebarProps {
  open: boolean;
  onNavigate: () => void;
  /** Signed-in admin's email, shown in the footer user card once loaded. */
  email: string;
}

/** Left navigation rail. Slides in as an overlay on mobile (see `.cc-sidebar` in admin.css). */
export function Sidebar({ open, onNavigate, email }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`cc-sidebar ${open ? "open" : ""}`}>
      <div className="cc-brand">
        <Image src={logoLight} alt="Introlines Merchant Exports" className="cc-brand-logo" priority />
      </div>
      {NAV.map((group) => (
        <div key={group.group}>
          <div className="cc-navgroup-label">{group.group}</div>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`cc-navitem ${pathname === item.href ? "active" : ""}`}
            >
              <item.icon size={16} /> {item.label}
            </Link>
          ))}
        </div>
      ))}

      <div className="cc-sidebar-user">
        <div className="cc-avatar">{email ? email[0].toUpperCase() : "A"}</div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email || "Admin"}
          </span>
          <span className="cc-mono" style={{ fontSize: 11.5, color: "oklch(0.66 0.015 228)" }}>
            Superadmin
          </span>
        </div>
      </div>
    </aside>
  );
}
