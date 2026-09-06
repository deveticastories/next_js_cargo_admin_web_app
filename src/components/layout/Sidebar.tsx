"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ship } from "lucide-react";
import { NAV } from "@/utils/navigation";

export interface SidebarProps {
  open: boolean;
  onNavigate: () => void;
}

/** Left navigation rail. Slides in as an overlay on mobile (see `.cc-sidebar` in admin.css). */
export function Sidebar({ open, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`cc-sidebar ${open ? "open" : ""}`}>
      <div className="cc-brand">
        <div className="cc-brand-mark">
          <Ship size={18} color="#2A1600" />
        </div>
        <div>
          <div className="cc-brand-name cc-h">Cargo Admin</div>
          <div className="cc-brand-sub">Kochi ⇄ UAE</div>
        </div>
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
    </aside>
  );
}
