"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, ClipboardList, Container as ContainerIcon, FileText, PackageCheck, Users, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, SkeletonStatGrid, SkeletonTable } from "@/components/ui/Skeleton";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { colors } from "@/utils/colors";
import { chartTick } from "@/utils/sizes";
import { money } from "@/utils/format";

const tooltipStyle = { fontSize: 12, borderRadius: 10, border: `1px solid ${colors.border}`, boxShadow: "0 8px 20px -12px rgba(0,0,0,0.25)" };
const tick = { fontSize: chartTick.fontSize, fill: colors.textSoft };

const QUICK_LINKS = [
  { href: "/admin/booking", label: "New booking", icon: ClipboardList },
  { href: "/admin/ready-to-ship", label: "Ready to ship", icon: PackageCheck },
  { href: "/admin/stuffing", label: "Stuffing", icon: ContainerIcon },
  { href: "/admin/invoicing", label: "Invoicing", icon: FileText },
];

/** Landing screen: hero, animated key numbers, charts of the cargo pipeline, and recent activity. */
export function DashboardScreen() {
  const { bookings, containers, dailyExpenses, employees } = useCargoData();
  const loading = bookings.loading || containers.loading || dailyExpenses.loading || employees.loading;

  const stats = useMemo(() => {
    const items = bookings.items;
    const ready = items.filter((b) => b.repackingStatus === "Ready to Ship" && !b.stuffed);
    const stuffed = items.filter((b) => b.stuffed);
    const repacking = items.filter((b) => b.repackingStatus !== "Ready to Ship" && !b.stuffed);
    return {
      total: items.length,
      ready: ready.length,
      readyBundles: items.filter((b) => b.repackingStatus === "Ready to Ship").reduce((s, b) => s + Number(b.bundleCount || 0), 0),
      stuffed: stuffed.length,
      repacking: repacking.length,
    };
  }, [bookings.items]);

  const monthExpense = dailyExpenses.items.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const activeContainers = containers.items.filter((c) => c.status === "Active").length;
  const activeStaff = employees.items.filter((e) => e.status === "Active").length;

  // Bookings per calendar month, in chronological order.
  const monthly = useMemo(() => {
    const buckets = new Map<string, { label: string; count: number }>();
    [...bookings.items]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((b) => {
        const d = new Date(b.date);
        if (Number.isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const label = d.toLocaleDateString("en-GB", { month: "short" });
        const cur = buckets.get(key) ?? { label, count: 0 };
        cur.count += 1;
        buckets.set(key, cur);
      });
    return [...buckets.values()].map((v) => ({ month: v.label, count: v.count }));
  }, [bookings.items]);

  const pipeline = [
    { name: "Repacking", value: stats.repacking, color: colors.warn },
    { name: "Ready to ship", value: stats.ready, color: colors.accent },
    { name: "Stuffed", value: stats.stuffed, color: colors.info },
  ];

  const expenseByType = useMemo(() => {
    const totals: Record<string, number> = {};
    dailyExpenses.items.forEach((e) => {
      const k = e.type || "Other";
      totals[k] = (totals[k] || 0) + Number(e.amount || 0);
    });
    return Object.entries(totals)
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [dailyExpenses.items]);

  const tiles = [
    { label: "Total bookings", value: stats.total, icon: ClipboardList, tone: "accent", note: `${stats.repacking} in repacking` },
    { label: "Bundles ready to ship", value: stats.readyBundles, icon: Boxes, tone: "success", note: "Packed and waiting" },
    { label: "Active containers", value: activeContainers, icon: ContainerIcon, tone: "info", note: "In rotation" },
    { label: "Expense logged", value: monthExpense, icon: Wallet, tone: "warn", format: money, note: `${dailyExpenses.items.length} entries` },
    { label: "Active staff", value: activeStaff, icon: Users, tone: "violet", note: "On the team" },
  ];

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const pipelineTotal = pipeline.reduce((s, p) => s + p.value, 0);

  return (
    <div className="cc-dash">
      <section className="cc-dash-hero">
        <div>
          <div className="cc-dash-date">{today}</div>
          <h2 className="cc-dash-title cc-h">Cargo operations at a glance</h2>
          <p className="cc-dash-sub">
            {loading ? "Loading your shipments…" : `${stats.total} bookings tracked · ${stats.ready} ready to be stuffed · ${stats.stuffed} shipped out`}
          </p>
        </div>
        <div className="cc-dash-actions">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="cc-dash-action">
              <Icon size={15} /> {label} <ArrowRight size={13} className="cc-dash-action-arrow" />
            </Link>
          ))}
        </div>
      </section>

      {loading ? (
        <SkeletonStatGrid count={5} />
      ) : (
        <div className="cc-dash-tiles">
          {tiles.map((t, i) => (
            <div key={t.label} className={`cc-dash-tile tone-${t.tone}`} style={{ animationDelay: `${i * 70}ms` }}>
              <div className="cc-dash-tile-icon">
                <t.icon size={18} />
              </div>
              <div className="cc-dash-tile-label">{t.label}</div>
              <div className="cc-dash-tile-value cc-h">
                <AnimatedNumber value={t.value} format={t.format} />
              </div>
              <div className="cc-dash-tile-note">{t.note}</div>
            </div>
          ))}
        </div>
      )}

      <div className="cc-dash-grid">
        <div className="cc-card cc-dash-panel cc-dash-wide">
          <div className="cc-dash-panel-head">
            <div>
              <div className="cc-panel-title">Bookings trend</div>
              <div className="cc-panel-desc">New bookings per month</div>
            </div>
          </div>
          {loading ? (
            <Skeleton width="100%" height={240} radius={10} />
          ) : monthly.length ? (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={colors.border} vertical={false} />
                  <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" name="Bookings" stroke={colors.accent} strokeWidth={2.5} fill="url(#dashArea)" animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="cc-empty">No bookings yet.</div>
          )}
        </div>

        <div className="cc-card cc-dash-panel">
          <div className="cc-dash-panel-head">
            <div>
              <div className="cc-panel-title">Shipment pipeline</div>
              <div className="cc-panel-desc">Where every booking stands</div>
            </div>
          </div>
          {loading ? (
            <Skeleton width="100%" height={240} radius={10} />
          ) : pipelineTotal ? (
            <>
              <div className="cc-dash-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pipeline} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none" animationDuration={1100}>
                      {pipeline.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="cc-dash-donut-center">
                  <div className="cc-dash-donut-num cc-h">{pipelineTotal}</div>
                  <div className="cc-dash-donut-cap">bookings</div>
                </div>
              </div>
              <ul className="cc-dash-legend">
                {pipeline.map((p) => (
                  <li key={p.name}>
                    <span className="cc-dash-legend-dot" style={{ background: p.color }} />
                    {p.name}
                    <b>{p.value}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="cc-empty">No bookings yet.</div>
          )}
        </div>
      </div>

      <div className="cc-dash-grid cc-dash-grid--even">
        <div className="cc-card cc-dash-panel">
          <div className="cc-dash-panel-head">
            <div>
              <div className="cc-panel-title">Expenses by type</div>
              <div className="cc-panel-desc">Top spending categories</div>
            </div>
          </div>
          {loading ? (
            <Skeleton width="100%" height={220} radius={10} />
          ) : expenseByType.length ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseByType} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={colors.border} horizontal={false} />
                  <XAxis type="number" tick={tick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="type" tick={tick} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} cursor={{ fill: colors.accentSoft }} />
                  <Bar dataKey="amount" name="Amount" fill={colors.accent} radius={[0, 6, 6, 0]} animationDuration={1100} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="cc-empty">No expenses logged.</div>
          )}
        </div>

        <div className="cc-card cc-dash-panel" style={{ padding: 0 }}>
          <div className="cc-panel-head">
            <div className="cc-panel-title">Recent bookings</div>
            <Link href="/admin/booking" className="cc-dash-link">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {loading ? (
            <SkeletonTable columns={4} rows={5} />
          ) : (
            <DataTable
              columns={[
                { key: "code", label: "Booking ID" },
                { key: "sender", label: "Sender" },
                { key: "receiver", label: "Receiver" },
                { key: "status", label: "Status", render: (r) => <Badge value={r.stuffed ? "Stuffed" : "Pending"} /> },
              ]}
              rows={bookings.items.slice(-5).reverse()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
