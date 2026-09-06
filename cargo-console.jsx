import React, { useState, useMemo } from "react";
import {
  LayoutDashboard, Users, UsersRound, Warehouse, Truck, Bike, Tags,
  ClipboardList, PackagePlus, PackageCheck, Boxes, Ship, ArrowRightLeft,
  FileText, Wallet, Receipt, BarChart3, Plus, Search, Pencil, Trash2, X,
  Menu, Download, ArrowRight, CheckCircle2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ---------------------------------------------------------------------- */
/* Design tokens                                                          */
/* ---------------------------------------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

.cc-root{
  --navy:#0E2337; --navy-soft:#173350; --navy-line:#24405E;
  --accent:#DD8A34; --accent-dark:#B9701F; --accent-soft:#F7E4CB;
  --bg:#EEF2F0; --surface:#FFFFFF; --border:#DCE3E0;
  --text:#152436; --text-soft:#5C6C77; --text-faint:#8B98A1;
  --success:#2E8F5C; --success-bg:#E1F3E7;
  --danger:#C1443A; --danger-bg:#FBE9E6;
  --warn:#B9701F; --warn-bg:#FBECD9;
  --info:#2A6FA8; --info-bg:#E3EEF7;
  font-family:'Inter',sans-serif; color:var(--text); background:var(--bg);
  width:100%; min-height:100vh; display:flex; box-sizing:border-box;
}
.cc-root *{ box-sizing:border-box; }
.cc-h{ font-family:'Space Grotesk',sans-serif; }

.cc-sidebar{
  width:250px; flex-shrink:0; background:var(--navy); color:#DCE6EE;
  display:flex; flex-direction:column; padding:20px 14px; gap:6px;
  position:relative; z-index:20;
}
.cc-brand{ display:flex; align-items:center; gap:10px; padding:6px 8px 22px; }
.cc-brand-mark{
  width:34px; height:34px; border-radius:8px; background:var(--accent);
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.cc-brand-name{ font-size:16px; font-weight:600; line-height:1.2; }
.cc-brand-sub{ font-size:11.5px; color:#8DA3B8; }

.cc-navgroup-label{
  font-size:11.5px; color:#7690A6; margin:14px 10px 6px; font-weight:500;
}
.cc-navitem{
  display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px;
  font-size:13.5px; color:#C3D2DE; cursor:pointer; border:none; background:transparent;
  width:100%; text-align:left;
}
.cc-navitem:hover{ background:var(--navy-soft); color:#fff; }
.cc-navitem.active{ background:var(--accent); color:#2A1600; font-weight:600; }

.cc-main{ flex:1; display:flex; flex-direction:column; min-width:0; height:100vh; overflow:hidden; }
.cc-topbar{
  height:60px; flex-shrink:0; background:var(--surface); border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; padding:0 24px;
}
.cc-topbar-title{ font-size:17px; font-weight:600; }
.cc-topbar-sub{ font-size:12.5px; color:var(--text-soft); margin-top:1px; }
.cc-avatar{
  width:34px; height:34px; border-radius:50%; background:var(--accent-soft); color:var(--accent-dark);
  display:flex; align-items:center; justify-content:center; font-weight:600; font-size:13px;
}
.cc-content{ flex:1; overflow-y:auto; padding:24px 28px 60px; }

.cc-menu-btn{ display:none; background:none; border:none; cursor:pointer; color:var(--text); padding:6px; }

.cc-card{ background:var(--surface); border:1px solid var(--border); border-radius:10px; }
.cc-panel-head{
  display:flex; align-items:center; justify-content:space-between; padding:16px 18px;
  border-bottom:1px solid var(--border); gap:12px; flex-wrap:wrap;
}
.cc-panel-title{ font-size:15px; font-weight:600; }
.cc-panel-desc{ font-size:12.5px; color:var(--text-soft); margin-top:2px; }

.cc-search{
  display:flex; align-items:center; gap:8px; border:1px solid var(--border); border-radius:8px;
  padding:7px 10px; background:var(--bg); min-width:220px;
}
.cc-search input{ border:none; background:transparent; outline:none; font-size:13px; width:100%; color:var(--text); }

.cc-btn{
  display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600;
  padding:8px 14px; border-radius:8px; border:1px solid var(--border); background:var(--surface);
  color:var(--text); cursor:pointer;
}
.cc-btn:hover{ border-color:var(--text-faint); }
.cc-btn-primary{ background:var(--accent); border-color:var(--accent-dark); color:#2A1600; }
.cc-btn-primary:hover{ background:var(--accent-dark); color:#fff; }
.cc-btn-ghost{ border:none; background:transparent; padding:6px; }
.cc-btn-sm{ padding:5px 10px; font-size:12.5px; }

.cc-table-wrap{ overflow-x:auto; }
table.cc-table{ width:100%; border-collapse:collapse; font-size:13px; }
table.cc-table th{
  text-align:left; padding:10px 14px; color:var(--text-soft); font-weight:600;
  border-bottom:1px solid var(--border); white-space:nowrap; font-size:12px;
}
table.cc-table td{ padding:10px 14px; border-bottom:1px solid var(--border); white-space:nowrap; }
table.cc-table tr:last-child td{ border-bottom:none; }
table.cc-table tr:hover td{ background:#F7F9F8; }

.cc-badge{
  display:inline-flex; align-items:center; padding:3px 9px; border-radius:20px;
  font-size:11.5px; font-weight:600;
}

.cc-empty{ padding:40px 20px; text-align:center; color:var(--text-faint); font-size:13px; }

.cc-stat-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin-bottom:20px; }
.cc-stat{ background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px 18px; }
.cc-stat-label{ font-size:12px; color:var(--text-soft); margin-bottom:8px; }
.cc-stat-value{ font-size:24px; font-weight:700; font-family:'Space Grotesk',sans-serif; }
.cc-stat-note{ font-size:11.5px; color:var(--text-faint); margin-top:4px; }

.cc-modal-overlay{
  position:fixed; inset:0; background:rgba(14,35,55,0.45); display:flex; align-items:center;
  justify-content:center; z-index:100; padding:20px;
}
.cc-modal{
  background:var(--surface); border-radius:12px; width:100%; max-width:480px; max-height:88vh;
  overflow-y:auto; box-shadow:0 20px 50px rgba(0,0,0,0.25);
}
.cc-modal-head{
  display:flex; align-items:center; justify-content:space-between; padding:16px 20px;
  border-bottom:1px solid var(--border);
}
.cc-modal-body{ padding:18px 20px; display:flex; flex-direction:column; gap:14px; }
.cc-modal-foot{ padding:14px 20px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px; }

.cc-field label{ display:block; font-size:12.5px; font-weight:600; color:var(--text-soft); margin-bottom:5px; }
.cc-field input, .cc-field select, .cc-field textarea{
  width:100%; border:1px solid var(--border); border-radius:7px; padding:8px 10px;
  font-size:13.5px; font-family:'Inter',sans-serif; color:var(--text); background:var(--surface);
}
.cc-field input:focus, .cc-field select:focus, .cc-field textarea:focus{
  outline:none; border-color:var(--accent);
}
.cc-error{ font-size:12px; color:var(--danger); margin-top:4px; }

.cc-grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.cc-flow{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12.5px; color:var(--text-soft); margin-bottom:18px; }
.cc-flow-step{ display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:20px; background:var(--surface); border:1px solid var(--border); }
.cc-flow-step.active{ border-color:var(--accent); color:var(--accent-dark); font-weight:600; background:var(--accent-soft); }

.cc-two-col{ display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start; }
.cc-mini-label{ font-size:12px; color:var(--text-soft); font-weight:600; margin-bottom:8px; }
.cc-line-item-row{ display:grid; grid-template-columns:1fr 1fr 1.4fr 0.7fr 1fr 1.4fr auto; gap:8px; align-items:center; margin-bottom:8px; }
.cc-note-box{ background:var(--info-bg); color:var(--info); border-radius:8px; padding:10px 12px; font-size:12.5px; display:flex; gap:8px; align-items:flex-start; }
.cc-total-row{ display:flex; justify-content:space-between; padding:8px 0; font-size:13.5px; border-top:1px solid var(--border); margin-top:4px; }

@media (max-width:900px){
  .cc-sidebar{ position:fixed; top:0; left:0; bottom:0; transform:translateX(-100%); transition:transform .2s ease; }
  .cc-sidebar.open{ transform:translateX(0); }
  .cc-menu-btn{ display:inline-flex; }
  .cc-two-col, .cc-grid-2{ grid-template-columns:1fr; }
  .cc-content{ padding:16px; }
}
`;

/* ---------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ---------------------------------------------------------------------- */

const todayISO = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(4, "0");
const nextId = (prefix, list) => `${prefix}-${pad(list.length + 1)}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function isDuplicate(list, fields, values, excludeId) {
  return list.some(
    (row) =>
      row.id !== excludeId &&
      fields.every((f) => String(row[f] || "").trim().toLowerCase() === String(values[f] || "").trim().toLowerCase())
  );
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STYLE = {
  Active: { bg: "var(--success-bg)", c: "var(--success)" },
  Inactive: { bg: "var(--danger-bg)", c: "var(--danger)" },
  "Ready to Ship": { bg: "var(--success-bg)", c: "var(--success)" },
  "Repacking Required": { bg: "var(--warn-bg)", c: "var(--warn)" },
  Stuffed: { bg: "var(--info-bg)", c: "var(--info)" },
  "With Bill": { bg: "var(--info-bg)", c: "var(--info)" },
  "Without Bill": { bg: "var(--warn-bg)", c: "var(--warn)" },
};

function Badge({ value }) {
  const s = STATUS_STYLE[value] || { bg: "var(--bg)", c: "var(--text-soft)" };
  return <span className="cc-badge" style={{ background: s.bg, color: s.c }}>{value}</span>;
}

/* ---------------------------------------------------------------------- */
/* Generic building blocks                                                */
/* ---------------------------------------------------------------------- */

function StatCard({ label, value, note }) {
  return (
    <div className="cc-stat">
      <div className="cc-stat-label">{label}</div>
      <div className="cc-stat-value cc-h">{value}</div>
      {note && <div className="cc-stat-note">{note}</div>}
    </div>
  );
}

function Field({ field, value, onChange, error }) {
  const common = {
    value: value ?? "",
    onChange: (e) => onChange(field.key, e.target.value),
  };
  return (
    <div className="cc-field">
      <label>{field.label}{field.required ? " *" : ""}</label>
      {field.type === "select" ? (
        <select {...common}>
          <option value="">Choose {field.label.toLowerCase()}</option>
          {field.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea rows={3} {...common} />
      ) : (
        <input type={field.type || "text"} {...common} />
      )}
      {error && <div className="cc-error">{error}</div>}
    </div>
  );
}

function Modal({ title, onClose, children, onSubmit, submitLabel = "Save" }) {
  return (
    <div className="cc-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cc-modal">
        <div className="cc-modal-head">
          <div className="cc-panel-title">{title}</div>
          <button className="cc-btn cc-btn-ghost" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="cc-modal-body">{children}</div>
        <div className="cc-modal-foot">
          <button className="cc-btn" onClick={onClose}>Cancel</button>
          <button className="cc-btn cc-btn-primary" onClick={onSubmit}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

function DataTable({ columns, rows, onEdit, onDelete, emptyText = "No records yet." }) {
  if (!rows.length) return <div className="cc-empty">{emptyText}</div>;
  return (
    <div className="cc-table-wrap">
      <table className="cc-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            {(onEdit || onDelete) && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
              {(onEdit || onDelete) && (
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    {onEdit && <button className="cc-btn cc-btn-ghost" onClick={() => onEdit(row)} aria-label="Edit"><Pencil size={15} /></button>}
                    {onDelete && <button className="cc-btn cc-btn-ghost" onClick={() => onDelete(row)} aria-label="Delete"><Trash2 size={15} color="var(--danger)" /></button>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Generic master/detail CRUD screen used for most simple modules */
function MasterView({ title, desc, fields, columns, rows, setRows, idPrefix, dupFields, hasStatus = true, footer }) {
  const [query, setQuery] = useState("");
  const [modalRow, setModalRow] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, query]);

  const openNew = () => { setForm(hasStatus ? { status: "Active" } : {}); setModalRow("new"); setError(""); };
  const openEdit = (row) => { setForm(row); setModalRow(row.id); setError(""); };
  const close = () => setModalRow(null);

  const save = () => {
    for (const f of fields) {
      if (f.required && !String(form[f.key] || "").trim()) { setError(`${f.label} is required.`); return; }
    }
    if (dupFields && isDuplicate(rows, dupFields, form, modalRow === "new" ? undefined : modalRow)) {
      setError(`A record with the same ${dupFields.join(" + ")} already exists.`);
      return;
    }
    if (modalRow === "new") {
      const id = nextId(idPrefix, rows);
      setRows([...rows, { ...form, id }]);
    } else {
      setRows(rows.map((r) => (r.id === modalRow ? { ...r, ...form } : r)));
    }
    close();
  };

  const remove = (row) => { if (window.confirm(`Remove ${row.name || row.id}?`)) setRows(rows.filter((r) => r.id !== row.id)); };
  const toggleStatus = (row) => setRows(rows.map((r) => (r.id === row.id ? { ...r, status: r.status === "Active" ? "Inactive" : "Active" } : r)));

  const allColumns = hasStatus
    ? [...columns, { key: "status", label: "Status", render: (r) => <span onClick={() => toggleStatus(r)} style={{ cursor: "pointer" }}><Badge value={r.status} /></span> }]
    : columns;

  return (
    <div className="cc-card">
      <div className="cc-panel-head">
        <div>
          <div className="cc-panel-title">{title}</div>
          <div className="cc-panel-desc">{desc}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="cc-search"><Search size={15} color="var(--text-faint)" /><input placeholder="Search records" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <button className="cc-btn cc-btn-primary" onClick={openNew}><Plus size={15} /> New</button>
        </div>
      </div>
      <DataTable columns={allColumns} rows={filtered} onEdit={openEdit} onDelete={remove} />
      {footer && footer(rows)}
      {modalRow && (
        <Modal title={modalRow === "new" ? `Add ${title}` : `Edit ${title}`} onClose={close} onSubmit={save}>
          {fields.map((f) => (
            <Field key={f.key} field={f} value={form[f.key]} onChange={(k, v) => setForm({ ...form, [k]: v })} error={error && f.required && !form[f.key] ? error : null} />
          ))}
          {hasStatus && <Field field={{ key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] }} value={form.status} onChange={(k, v) => setForm({ ...form, [k]: v })} />}
          {error && <div className="cc-error">{error}</div>}
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Seed data                                                               */
/* ---------------------------------------------------------------------- */

const SEED = {
  employees: [
    { id: "EMP-0001", name: "Anoop Nair", empId: "EMP-0001", contact: "9847012345", bloodGroup: "O+", role: "Admin", status: "Active" },
    { id: "EMP-0002", name: "Divya Menon", empId: "EMP-0002", contact: "9946011122", bloodGroup: "B+", role: "Employee", status: "Active" },
    { id: "EMP-0003", name: "Rahul Krishna", empId: "EMP-0003", contact: "9995512233", bloodGroup: "A+", role: "Employee", status: "Inactive" },
  ],
  senders: [
    { id: "SND-0001", name: "Faisal Textiles", whatsapp: "9744123456", location: "Kochi", status: "Active" },
    { id: "SND-0002", name: "Green Leaf Exports", whatsapp: "9847099887", location: "Kozhikode", status: "Active" },
  ],
  receivers: [
    { id: "RCV-0001", name: "Ahmed Al Farsi", whatsapp: "+971501234567", country: "UAE", location: "Dubai", discount: "5", status: "Active" },
    { id: "RCV-0002", name: "Mariam Hassan", whatsapp: "+971555987654", country: "UAE", location: "Sharjah", discount: "0", status: "Active" },
  ],
  stores: [
    { id: "STR-0001", location: "Kochi (Main Store)", contact: "0484-2345678", inCharge: "Sunil P.", status: "Active" },
    { id: "STR-0002", location: "Dubai (UAE Store)", contact: "+971-4-1234567", inCharge: "Khalid R.", status: "Active" },
  ],
  deliveryPartners: [
    { id: "DLV-0001", name: "Al Noor Cargo Delivery", whatsapp: "+971521112233", from: "Dubai", toCountry: "UAE", charge: "25", status: "Active" },
    { id: "DLV-0002", name: "Rapid Link Movers", whatsapp: "+971561234567", from: "Sharjah", toCountry: "UAE", charge: "20", status: "Active" },
  ],
  pickupPartners: [
    { id: "PCK-0001", name: "Manu Pickup Services", whatsapp: "9895512121", status: "Active" },
    { id: "PCK-0002", name: "City Express Pickup", whatsapp: "9847065432", status: "Active" },
  ],
  pricing: [
    { id: "PRC-0001", from: "Kochi", to: "Dubai", uom: "Kg", price: "18" },
    { id: "PRC-0002", from: "Kochi", to: "Sharjah", uom: "Kg", price: "16" },
    { id: "PRC-0003", from: "Kochi", to: "Abu Dhabi", uom: "Kg", price: "20" },
  ],
  pickupAssigns: [
    { id: "PKA-0001", transport: "Manu Pickup Services", lrNo: "LR-88231", status: "Active" },
  ],
  bookings: [
    { id: "BKG-0001", sender: "Faisal Textiles", receiver: "Ahmed Al Farsi", pickupOption: "Our Pickup Boy", date: "2026-08-20", billOption: "With Bill", bundleCount: "6", repackingStatus: "Ready to Ship", status: "Active", stuffed: false },
    { id: "BKG-0002", sender: "Green Leaf Exports", receiver: "Mariam Hassan", pickupOption: "Pickup Partner", date: "2026-08-25", billOption: "Without Bill", bundleCount: "4", repackingStatus: "Repacking Required", status: "Active", stuffed: false },
    { id: "BKG-0003", sender: "Faisal Textiles", receiver: "Ahmed Al Farsi", pickupOption: "Direct to Store", date: "2026-08-28", billOption: "With Bill", bundleCount: "3", repackingStatus: "Ready to Ship", status: "Active", stuffed: false },
  ],
  containers: [
    { id: "CNT-0001", company: "Al Fahad Shipping Line", stuffingDate: "2026-09-05", cutOffDate: "2026-09-06", etaCok: "2026-09-01", etdCok: "2026-09-07", etaUae: "2026-09-14", status: "Active" },
  ],
  dailyExpenses: [
    { id: "EXP-0001", date: "2026-09-01", type: "Fuel", paymentType: "Cash", amount: "1200", description: "Pickup van fuel" },
    { id: "EXP-0002", date: "2026-09-02", type: "Packing Material", paymentType: "UPI", amount: "850", description: "Tape and covers" },
  ],
  creditNotes: [
    { id: "CN-0001", date: "2026-09-01", amount: "20000", description: "September petty cash — opening balance" },
  ],
};

/* ---------------------------------------------------------------------- */
/* Navigation config                                                       */
/* ---------------------------------------------------------------------- */

const NAV = [
  { group: "Overview", items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { group: "Masters", items: [
    { key: "team", label: "Team", icon: Users },
    { key: "customers", label: "Customers", icon: UsersRound },
    { key: "stores", label: "Stores", icon: Warehouse },
    { key: "deliveryPartners", label: "Delivery partners", icon: Truck },
    { key: "pickupPartners", label: "Pickup partners", icon: Bike },
    { key: "pricing", label: "Pricing", icon: Tags },
  ]},
  { group: "Operations", items: [
    { key: "pickupAssign", label: "Pickup assign", icon: ClipboardList },
    { key: "booking", label: "Booking", icon: PackagePlus },
    { key: "readyToShip", label: "Ready to ship", icon: PackageCheck },
    { key: "repacking", label: "Repacking", icon: Boxes },
    { key: "containers", label: "Containers", icon: Ship },
    { key: "stuffing", label: "Stuffing", icon: ArrowRightLeft },
  ]},
  { group: "Finance", items: [
    { key: "invoicing", label: "Invoicing", icon: FileText },
    { key: "creditNote", label: "Credit note", icon: Wallet },
    { key: "expenses", label: "Daily expense", icon: Receipt },
  ]},
  { group: "Reports", items: [{ key: "reports", label: "Reports", icon: BarChart3 }] },
];

const TITLES = {
  dashboard: ["Dashboard", "A quick look at today's operations"],
  team: ["Team", "Admins and employees who use this console"],
  customers: ["Customers", "Senders who book shipments and receivers who collect them"],
  stores: ["Stores", "Kochi and UAE store locations"],
  deliveryPartners: ["Delivery partners", "Last-mile delivery vendors at the receiving end"],
  pickupPartners: ["Pickup partners", "Third-party partners who collect bundles from senders"],
  pricing: ["Pricing", "Route-wise price per unit of measure"],
  pickupAssign: ["Pickup assign", "Assign a transport and LR number to a collection run"],
  booking: ["Booking", "Create and track shipment bookings"],
  readyToShip: ["Ready to ship", "Pack bundles and download the shipping list"],
  repacking: ["Repacking", "Repack bundles before they move to ready to ship"],
  containers: ["Container management", "Track containers moving between Kochi and the UAE"],
  stuffing: ["Stuffing", "Load ready-to-ship bookings into a container"],
  invoicing: ["Invoicing", "Generate invoices and delivery notes"],
  creditNote: ["Credit note", "Petty cash fund, carried forward month to month"],
  expenses: ["Daily expense", "Log day-to-day operational spends"],
  reports: ["Reports", "Booking activity by month, container, country and customer"],
};

/* ---------------------------------------------------------------------- */
/* Dashboard                                                               */
/* ---------------------------------------------------------------------- */

function Dashboard({ data }) {
  const { bookings, containers, dailyExpenses, employees } = data;
  const readyBundles = bookings.filter((b) => b.repackingStatus === "Ready to Ship").reduce((s, b) => s + Number(b.bundleCount || 0), 0);
  const monthExpense = dailyExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const activeContainers = containers.filter((c) => c.status === "Active").length;
  const activeStaff = employees.filter((e) => e.status === "Active").length;

  const monthly = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      const m = new Date(b.date).toLocaleDateString("en-GB", { month: "short" });
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).map(([month, count]) => ({ month, count }));
  }, [bookings]);

  return (
    <div>
      <div className="cc-flow">
        <div className="cc-flow-step active">Booking</div>
        <ArrowRight size={14} />
        <div className="cc-flow-step">Repack / Ready to ship</div>
        <ArrowRight size={14} />
        <div className="cc-flow-step">Stuffing</div>
        <ArrowRight size={14} />
        <div className="cc-flow-step">Invoicing</div>
      </div>
      <div className="cc-stat-grid">
        <StatCard label="Total bookings" value={bookings.length} note={`${bookings.filter(b=>b.status==='Active').length} active`} />
        <StatCard label="Bundles ready to ship" value={readyBundles} />
        <StatCard label="Active containers" value={activeContainers} />
        <StatCard label="Expense logged" value={money(monthExpense)} />
        <StatCard label="Active staff" value={activeStaff} />
      </div>
      <div className="cc-two-col">
        <div className="cc-card" style={{ padding: 18 }}>
          <div className="cc-mini-label">Bookings by month</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-soft)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--text-soft)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="cc-card">
          <div className="cc-panel-head"><div className="cc-panel-title">Recent bookings</div></div>
          <DataTable
            columns={[
              { key: "id", label: "Booking ID" },
              { key: "sender", label: "Sender" },
              { key: "receiver", label: "Receiver" },
              { key: "repackingStatus", label: "Status", render: (r) => <Badge value={r.repackingStatus} /> },
            ]}
            rows={bookings.slice(-5).reverse()}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Customers (Sender / Receiver tabs)                                      */
/* ---------------------------------------------------------------------- */

function Customers({ data }) {
  const [tab, setTab] = useState("sender");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button className={`cc-btn ${tab === "sender" ? "cc-btn-primary" : ""}`} onClick={() => setTab("sender")}>Senders</button>
        <button className={`cc-btn ${tab === "receiver" ? "cc-btn-primary" : ""}`} onClick={() => setTab("receiver")}>Receivers</button>
      </div>
      {tab === "sender" ? (
        <MasterView
          title="Senders" desc="People or businesses who book shipments"
          idPrefix="SND" dupFields={["whatsapp"]}
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "whatsapp", label: "WhatsApp number", required: true },
            { key: "location", label: "Location", required: true },
          ]}
          columns={[{ key: "name", label: "Name" }, { key: "whatsapp", label: "WhatsApp" }, { key: "location", label: "Location" }]}
          rows={data.senders} setRows={data.setSenders}
        />
      ) : (
        <MasterView
          title="Receivers" desc="People who collect shipments at the destination"
          idPrefix="RCV" dupFields={["whatsapp"]}
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "whatsapp", label: "WhatsApp number", required: true },
            { key: "country", label: "Country", required: true },
            { key: "location", label: "Location", required: true },
            { key: "discount", label: "Discount (%)", type: "number" },
          ]}
          columns={[
            { key: "name", label: "Name" }, { key: "whatsapp", label: "WhatsApp" },
            { key: "country", label: "Country" }, { key: "location", label: "Location" },
            { key: "discount", label: "Discount", render: (r) => `${r.discount || 0}%` },
          ]}
          rows={data.receivers} setRows={data.setReceivers}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Booking                                                                 */
/* ---------------------------------------------------------------------- */

function BookingModule({ data }) {
  const { bookings, setBookings, senders, receivers, pickupPartners } = data;
  const [query, setQuery] = useState("");
  const [modalRow, setModalRow] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");

  const pickupOptions = ["Our Pickup Boy", "Direct to Store", ...pickupPartners.filter((p) => p.status === "Active").map((p) => p.name)];
  const filtered = bookings.filter((b) => Object.values(b).some((v) => String(v).toLowerCase().includes(query.toLowerCase())));
  const readyBundles = bookings.filter((b) => b.repackingStatus === "Ready to Ship").reduce((s, b) => s + Number(b.bundleCount || 0), 0);

  const openNew = () => { setForm({ date: todayISO(), billOption: "With Bill", repackingStatus: "Repacking Required", status: "Active" }); setModalRow("new"); setError(""); };
  const openEdit = (row) => { setForm(row); setModalRow(row.id); setError(""); };

  const save = () => {
    if (!form.sender || !form.receiver || !form.pickupOption || !form.bundleCount) { setError("Sender, receiver, pickup option and bundle count are required."); return; }
    if (modalRow === "new") setBookings([...bookings, { ...form, id: nextId("BKG", bookings), stuffed: false }]);
    else setBookings(bookings.map((b) => (b.id === modalRow ? { ...b, ...form } : b)));
    setModalRow(null);
  };

  return (
    <div>
      <div className="cc-stat-grid">
        <StatCard label="Total bookings" value={bookings.length} />
        <StatCard label="Ready-to-ship bundles" value={readyBundles} />
      </div>
      <div className="cc-card">
        <div className="cc-panel-head">
          <div><div className="cc-panel-title">Bookings</div><div className="cc-panel-desc">Every shipment booked, with its current pack status</div></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div className="cc-search"><Search size={15} color="var(--text-faint)" /><input placeholder="Search bookings" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <button className="cc-btn cc-btn-primary" onClick={openNew}><Plus size={15} /> New booking</button>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "id", label: "Booking ID" },
            { key: "sender", label: "Sender" },
            { key: "receiver", label: "Receiver" },
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            { key: "bundleCount", label: "Bundles" },
            { key: "billOption", label: "Bill", render: (r) => <Badge value={r.billOption} /> },
            { key: "repackingStatus", label: "Pack status", render: (r) => <Badge value={r.repackingStatus} /> },
            { key: "stuffed", label: "Stuffed", render: (r) => (r.stuffed ? <Badge value="Stuffed" /> : "—") },
            { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
          ]}
          rows={filtered}
          onEdit={openEdit}
          onDelete={(row) => window.confirm(`Delete booking ${row.id}?`) && setBookings(bookings.filter((b) => b.id !== row.id))}
        />
      </div>
      {modalRow && (
        <Modal title={modalRow === "new" ? "New booking" : `Edit ${modalRow}`} onClose={() => setModalRow(null)} onSubmit={save} submitLabel="Save booking">
          <div className="cc-grid-2">
            <Field field={{ key: "sender", label: "Sender", type: "select", options: senders.map((s) => s.name) }} value={form.sender} onChange={(k, v) => setForm({ ...form, [k]: v })} />
            <Field field={{ key: "receiver", label: "Receiver", type: "select", options: receivers.map((r) => r.name) }} value={form.receiver} onChange={(k, v) => setForm({ ...form, [k]: v })} />
          </div>
          <Field field={{ key: "pickupOption", label: "Pick up via", type: "select", options: pickupOptions }} value={form.pickupOption} onChange={(k, v) => setForm({ ...form, [k]: v })} />
          <div className="cc-grid-2">
            <Field field={{ key: "date", label: "Booking date", type: "date" }} value={form.date} onChange={(k, v) => setForm({ ...form, [k]: v })} />
            <Field field={{ key: "billOption", label: "Bill option", type: "select", options: ["With Bill", "Without Bill"] }} value={form.billOption} onChange={(k, v) => setForm({ ...form, [k]: v })} />
          </div>
          <div className="cc-grid-2">
            <Field field={{ key: "bundleCount", label: "Bundle count", type: "number" }} value={form.bundleCount} onChange={(k, v) => setForm({ ...form, [k]: v })} />
            <Field field={{ key: "repackingStatus", label: "Pack status", type: "select", options: ["Ready to Ship", "Repacking Required"] }} value={form.repackingStatus} onChange={(k, v) => setForm({ ...form, [k]: v })} />
          </div>
          <Field field={{ key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] }} value={form.status} onChange={(k, v) => setForm({ ...form, [k]: v })} />
          {error && <div className="cc-error">{error}</div>}
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Ready to Ship / Repacking (shared bundle-item workspace)                */
/* ---------------------------------------------------------------------- */

function emptyLine() { return { id: Math.random().toString(36).slice(2), netWeight: "", grossWeight: "", product: "", qty: "", fabric: "", description: "" }; }

function BundleWorkspace({ mode, data }) {
  const { bookings, setBookings, bundleItems, setBundleItems } = data;
  const eligible = bookings.filter((b) => b.repackingStatus === (mode === "ready" ? "Ready to Ship" : "Repacking Required"));
  const [bookingId, setBookingId] = useState("");
  const [bundle, setBundle] = useState("1");
  const [lines, setLines] = useState([emptyLine()]);
  const [afterCount, setAfterCount] = useState("");
  const [repackedBy, setRepackedBy] = useState("");

  const booking = bookings.find((b) => b.id === bookingId);
  const key = booking ? `${bookingId}#${bundle}` : null;

  const selectBooking = (id) => { setBookingId(id); setBundle("1"); const b = bookings.find((x) => x.id === id); setLines(bundleItems[`${id}#1`]?.items || [emptyLine()]); setAfterCount(b?.bundleCount || ""); };
  const selectBundle = (n) => { setBundle(n); setLines(bundleItems[`${bookingId}#${n}`]?.items || [emptyLine()]); };

  const updateLine = (id, key2, val) => setLines(lines.map((l) => (l.id === id ? { ...l, [key2]: val } : l)));
  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (id) => setLines(lines.filter((l) => l.id !== id));

  const persistLines = () => { if (key) setBundleItems({ ...bundleItems, [key]: { items: lines } }); };

  const downloadList = () => {
    persistLines();
    const rows = lines.map((l) => `${l.product} | Qty ${l.qty} | ${l.fabric} | Net ${l.netWeight}kg | Gross ${l.grossWeight}kg | ${l.description}`).join("\n");
    downloadText(`${bookingId}-bundle-${bundle}-ready-to-ship.txt`, `Ready to ship list\nBooking: ${bookingId}\nBundle: ${bundle}\n\n${rows}`);
  };

  const completeRepacking = () => {
    if (!afterCount || !repackedBy) { alert("Enter the bundle count after repacking and who repacked it."); return; }
    persistLines();
    setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, repackingStatus: "Ready to Ship", bundleCount: afterCount } : b)));
    setBookingId(""); setBundle("1"); setLines([emptyLine()]); setAfterCount(""); setRepackedBy("");
  };

  const bundleCountOf = booking ? Number(booking.bundleCount || 1) : 0;
  const bundleOptions = Array.from({ length: bundleCountOf || 1 }, (_, i) => String(i + 1));

  return (
    <div className="cc-card" style={{ padding: 18 }}>
      <div className="cc-grid-2" style={{ marginBottom: 16 }}>
        <div className="cc-field">
          <label>Booking ID</label>
          <select value={bookingId} onChange={(e) => selectBooking(e.target.value)}>
            <option value="">Choose a booking</option>
            {eligible.map((b) => <option key={b.id} value={b.id}>{b.id} — {b.sender} → {b.receiver}</option>)}
          </select>
        </div>
        <div className="cc-field">
          <label>Bundle</label>
          <select value={bundle} onChange={(e) => selectBundle(e.target.value)} disabled={!bookingId}>
            {bundleOptions.map((n) => <option key={n} value={n}>Bundle {n}</option>)}
          </select>
        </div>
      </div>

      {bookingId && (
        <>
          <div className="cc-mini-label">Packing list</div>
          <div className="cc-line-item-row" style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>
            <span>Net wt (kg)</span><span>Gross wt (kg)</span><span>Product name</span><span>Qty</span><span>Fabric</span><span>Description</span><span></span>
          </div>
          {lines.map((l) => (
            <div className="cc-line-item-row" key={l.id}>
              <input value={l.netWeight} onChange={(e) => updateLine(l.id, "netWeight", e.target.value)} style={inputCss} />
              <input value={l.grossWeight} onChange={(e) => updateLine(l.id, "grossWeight", e.target.value)} style={inputCss} />
              <input value={l.product} onChange={(e) => updateLine(l.id, "product", e.target.value)} style={inputCss} />
              <input value={l.qty} onChange={(e) => updateLine(l.id, "qty", e.target.value)} style={inputCss} />
              <input value={l.fabric} onChange={(e) => updateLine(l.id, "fabric", e.target.value)} style={inputCss} />
              <input value={l.description} onChange={(e) => updateLine(l.id, "description", e.target.value)} style={inputCss} />
              <button className="cc-btn cc-btn-ghost" onClick={() => removeLine(l.id)} aria-label="Remove line"><X size={15} /></button>
            </div>
          ))}
          <button className="cc-btn cc-btn-sm" onClick={addLine} style={{ marginBottom: 16 }}><Plus size={14} /> Add item</button>

          {mode === "ready" ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="cc-btn cc-btn-primary" onClick={downloadList}><Download size={15} /> Download ready-to-ship list</button>
            </div>
          ) : (
            <>
              <div className="cc-grid-2" style={{ marginTop: 6 }}>
                <Field field={{ key: "afterCount", label: "Bundle count after repacking", type: "number" }} value={afterCount} onChange={(k, v) => setAfterCount(v)} />
                <Field field={{ key: "repackedBy", label: "Repacked by" }} value={repackedBy} onChange={(k, v) => setRepackedBy(v)} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="cc-btn cc-btn-primary" onClick={completeRepacking}><CheckCircle2 size={15} /> Complete repacking, move to ready to ship</button>
              </div>
            </>
          )}
        </>
      )}
      {!bookingId && <div className="cc-empty">Choose a booking above to build its packing list.</div>}
    </div>
  );
}
const inputCss = { border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", fontSize: 12.5, width: "100%" };

/* ---------------------------------------------------------------------- */
/* Stuffing                                                                */
/* ---------------------------------------------------------------------- */

function StuffingModule({ data }) {
  const { bookings, setBookings, containers, stuffings, setStuffings, uaeStoreLog, setUaeStoreLog } = data;
  const [containerId, setContainerId] = useState("");
  const [selected, setSelected] = useState([]);
  const [lastSummary, setLastSummary] = useState(null);

  const eligible = bookings.filter((b) => b.repackingStatus === "Ready to Ship" && !b.stuffed);
  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const submit = () => {
    if (!containerId || selected.length === 0) { alert("Choose a container and at least one booking."); return; }
    const id = nextId("STF", stuffings);
    const stuffedBookings = bookings.filter((b) => selected.includes(b.id));
    setStuffings([...stuffings, { id, containerId, bookingIds: selected, date: todayISO() }]);
    setBookings(bookings.map((b) => (selected.includes(b.id) ? { ...b, stuffed: true } : b)));
    setUaeStoreLog([...uaeStoreLog, ...stuffedBookings.map((b) => ({ id: `${id}-${b.id}`, bookingId: b.id, receiver: b.receiver, bundles: b.bundleCount, arrivedFrom: id, date: todayISO() }))]);
    setLastSummary({ id, containerId, bookings: stuffedBookings });
    setSelected([]); setContainerId("");
  };

  const downloadSummary = () => {
    if (!lastSummary) return;
    const rows = lastSummary.bookings.map((b) => `${b.id} | ${b.sender} → ${b.receiver} | ${b.bundleCount} bundles`).join("\n");
    downloadText(`${lastSummary.id}-booking-summary.txt`, `Stuffing ${lastSummary.id} — Container ${lastSummary.containerId}\n\n${rows}`);
  };

  return (
    <div>
      <div className="cc-card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="cc-field" style={{ maxWidth: 360, marginBottom: 14 }}>
          <label>Container</label>
          <select value={containerId} onChange={(e) => setContainerId(e.target.value)}>
            <option value="">Choose a container</option>
            {containers.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.company}</option>)}
          </select>
        </div>
        <div className="cc-mini-label">Ready-to-ship bookings available for stuffing</div>
        {eligible.length === 0 ? (
          <div className="cc-empty">No ready-to-ship bookings are waiting to be stuffed.</div>
        ) : (
          <div className="cc-table-wrap">
            <table className="cc-table">
              <thead><tr><th></th><th>Booking ID</th><th>Sender</th><th>Receiver</th><th>Bundles</th></tr></thead>
              <tbody>
                {eligible.map((b) => (
                  <tr key={b.id}>
                    <td><input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} /></td>
                    <td>{b.id}</td><td>{b.sender}</td><td>{b.receiver}</td><td>{b.bundleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button className="cc-btn cc-btn-primary" onClick={submit}><ArrowRightLeft size={15} /> Submit stuffing</button>
        </div>
      </div>

      {lastSummary && (
        <div className="cc-card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="cc-mini-label">Stuffing {lastSummary.id} completed</div>
          <div className="cc-note-box" style={{ marginBottom: 12 }}>
            Booking summary was auto-sent to each receiver's registered WhatsApp number, and the stuffed list has been copied to the UAE store.
          </div>
          <button className="cc-btn" onClick={downloadSummary}><Download size={15} /> Download booking summary</button>
        </div>
      )}

      <div className="cc-card">
        <div className="cc-panel-head"><div className="cc-panel-title">UAE store — incoming log</div></div>
        <DataTable
          emptyText="Nothing has arrived at the UAE store yet."
          columns={[
            { key: "bookingId", label: "Booking ID" }, { key: "receiver", label: "Receiver" },
            { key: "bundles", label: "Bundles" }, { key: "arrivedFrom", label: "Stuffing ref" },
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
          ]}
          rows={uaeStoreLog.slice().reverse()}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Invoicing                                                               */
/* ---------------------------------------------------------------------- */

function InvoicingModule({ data }) {
  const { bookings, senders, receivers, pricing, deliveryPartners, bundleItems } = data;
  const [bookingId, setBookingId] = useState("");
  const [pickupCharge, setPickupCharge] = useState("0");
  const [deliveryPartner, setDeliveryPartner] = useState("");

  const [dnBookingId, setDnBookingId] = useState("");

  const booking = bookings.find((b) => b.id === bookingId);
  const receiver = receivers.find((r) => r.name === booking?.receiver);
  const route = pricing.find((p) => p.to === receiver?.location || p.to === receiver?.country);
  const unitPrice = route ? Number(route.price) : 0;
  const bundles = booking ? Number(booking.bundleCount || 0) : 0;
  const discountPct = receiver ? Number(receiver.discount || 0) : 0;
  const subtotal = unitPrice * bundles;
  const discountAmt = (subtotal * discountPct) / 100;
  const dp = deliveryPartners.find((d) => d.name === deliveryPartner);
  const deliveryCharge = dp ? Number(dp.charge) : 0;
  const showPickupCharge = booking?.billOption === "Without Bill";
  const total = subtotal - discountAmt + (showPickupCharge ? Number(pickupCharge || 0) : 0) + deliveryCharge;

  const generateInvoice = () => {
    if (!booking) { alert("Choose a booking first."); return; }
    const text = `INVOICE — ${booking.id}\nSender: ${booking.sender}\nReceiver: ${booking.receiver}\nRoute price: ${money(unitPrice)} x ${bundles} bundle(s) = ${money(subtotal)}\nDiscount (${discountPct}%): -${money(discountAmt)}\n${showPickupCharge ? `Pickup charge: ${money(pickupCharge)}\n` : ""}Delivery partner: ${deliveryPartner || "—"} (${money(deliveryCharge)})\nTOTAL: ${money(total)}`;
    downloadText(`${booking.id}-invoice.txt`, text);
  };

  const dnBooking = bookings.find((b) => b.id === dnBookingId);
  const packingRows = dnBooking ? Object.entries(bundleItems).filter(([k]) => k.startsWith(`${dnBookingId}#`)).flatMap(([, v]) => v.items) : [];

  const generateDeliveryNote = () => {
    if (!dnBooking) { alert("Choose a booking first."); return; }
    const rows = packingRows.map((l) => `${l.product} | Qty ${l.qty} | ${l.fabric}`).join("\n") || "No packing list recorded yet.";
    const text = `DELIVERY NOTE — ${dnBooking.id}\nSender: ${dnBooking.sender}\nBooking date: ${fmtDate(dnBooking.date)}\n\nPacking list:\n${rows}`;
    downloadText(`${dnBooking.id}-delivery-note.txt`, text);
  };

  return (
    <div className="cc-two-col">
      <div className="cc-card" style={{ padding: 18 }}>
        <div className="cc-panel-title" style={{ marginBottom: 4 }}>Generate invoice</div>
        <div className="cc-panel-desc" style={{ marginBottom: 14 }}>Price and discount are fetched automatically from the receiver's route.</div>
        <Field field={{ key: "b", label: "Booking ID", type: "select", options: bookings.map((b) => b.id) }} value={bookingId} onChange={(k, v) => setBookingId(v)} />
        {booking && (
          <>
            <div style={{ margin: "12px 0" }}>
              <div className="cc-total-row"><span>Route price ({route ? `${route.from} → ${route.to}` : "no route matched"})</span><span>{money(unitPrice)} × {bundles}</span></div>
              <div className="cc-total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="cc-total-row"><span>Receiver discount ({discountPct}%)</span><span>-{money(discountAmt)}</span></div>
            </div>
            {showPickupCharge && <Field field={{ key: "pc", label: "Pickup charge (booked without bill)", type: "number" }} value={pickupCharge} onChange={(k, v) => setPickupCharge(v)} />}
            <Field field={{ key: "dp", label: "Delivery partner", type: "select", options: deliveryPartners.map((d) => d.name) }} value={deliveryPartner} onChange={(k, v) => setDeliveryPartner(v)} />
            <div className="cc-total-row" style={{ fontWeight: 700, fontSize: 15 }}><span>Total</span><span>{money(total)}</span></div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button className="cc-btn cc-btn-primary" onClick={generateInvoice}><Download size={15} /> Generate & download invoice</button>
            </div>
          </>
        )}
      </div>

      <div className="cc-card" style={{ padding: 18 }}>
        <div className="cc-panel-title" style={{ marginBottom: 4 }}>Generate delivery note</div>
        <div className="cc-panel-desc" style={{ marginBottom: 14 }}>Packing list, sender and booking date are pulled in automatically.</div>
        <Field field={{ key: "b2", label: "Booking ID", type: "select", options: bookings.map((b) => b.id) }} value={dnBookingId} onChange={(k, v) => setDnBookingId(v)} />
        {dnBooking && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <div style={{ marginBottom: 6 }}><b>Sender:</b> {dnBooking.sender}</div>
            <div style={{ marginBottom: 12 }}><b>Booking date:</b> {fmtDate(dnBooking.date)}</div>
            <div className="cc-mini-label">Packing list ({packingRows.length} item{packingRows.length === 1 ? "" : "s"})</div>
            {packingRows.length === 0 ? <div className="cc-empty">No packing list recorded for this booking yet.</div> : (
              <ul style={{ fontSize: 12.5, color: "var(--text-soft)", paddingLeft: 18 }}>
                {packingRows.map((l, i) => <li key={i}>{l.product} — qty {l.qty}, {l.fabric}</li>)}
              </ul>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button className="cc-btn cc-btn-primary" onClick={generateDeliveryNote}><Download size={15} /> Generate & download note</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Credit Note                                                             */
/* ---------------------------------------------------------------------- */

function CreditNoteModule({ data }) {
  const { creditNotes, setCreditNotes } = data;
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({});
  const balance = creditNotes.reduce((s, c) => s + Number(c.amount || 0), 0);

  const save = () => {
    if (!form.amount) { alert("Enter an amount."); return; }
    setCreditNotes([...creditNotes, { id: nextId("CN", creditNotes), date: todayISO(), amount: form.amount, description: form.description || "" }]);
    setModalOpen(false); setForm({});
  };

  return (
    <div>
      <div className="cc-stat-grid">
        <StatCard label="Petty cash balance" value={money(balance)} note="Carries forward automatically to next month" />
      </div>
      <div className="cc-card">
        <div className="cc-panel-head">
          <div><div className="cc-panel-title">Fund entries</div><div className="cc-panel-desc">Petty cash added this period</div></div>
          <button className="cc-btn cc-btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add fund</button>
        </div>
        <DataTable
          columns={[
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            { key: "amount", label: "Amount", render: (r) => money(r.amount) },
            { key: "description", label: "Description" },
          ]}
          rows={creditNotes.slice().reverse()}
        />
      </div>
      {modalOpen && (
        <Modal title="Add fund" onClose={() => setModalOpen(false)} onSubmit={save} submitLabel="Add fund">
          <Field field={{ key: "amount", label: "Amount", type: "number" }} value={form.amount} onChange={(k, v) => setForm({ ...form, [k]: v })} />
          <Field field={{ key: "description", label: "Description", type: "textarea" }} value={form.description} onChange={(k, v) => setForm({ ...form, [k]: v })} />
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Reports                                                                 */
/* ---------------------------------------------------------------------- */

function ReportsModule({ data }) {
  const { bookings, containers, stuffings } = data;
  const [tab, setTab] = useState("monthly");

  const monthly = useMemo(() => {
    const map = {};
    bookings.forEach((b) => { const m = new Date(b.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" }); map[m] = (map[m] || 0) + 1; });
    return Object.entries(map).map(([month, count]) => ({ month, count }));
  }, [bookings]);

  const byContainer = containers.map((c) => ({ id: c.id, company: c.company, bookings: stuffings.filter((s) => s.containerId === c.id).reduce((s, st) => s + st.bookingIds.length, 0) }));

  const byCountry = useMemo(() => {
    const map = {};
    bookings.forEach((b) => { const rec = data.receivers.find((r) => r.name === b.receiver); const c = rec?.country || "Unknown"; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).map(([country, count]) => ({ country, count }));
  }, [bookings, data.receivers]);

  const byCustomer = useMemo(() => {
    const map = {};
    bookings.forEach((b) => { map[b.sender] = (map[b.sender] || 0) + 1; });
    return Object.entries(map).map(([sender, count]) => ({ sender, count }));
  }, [bookings]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["monthly", "Monthly"], ["container", "Container-wise"], ["country", "Country-wise"], ["customer", "Customer-wise"]].map(([k, l]) => (
          <button key={k} className={`cc-btn ${tab === k ? "cc-btn-primary" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "monthly" && (
        <div className="cc-card" style={{ padding: 18 }}>
          <div className="cc-mini-label">Bookings per month</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-soft)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--text-soft)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {tab === "container" && (
        <div className="cc-card"><DataTable columns={[{ key: "id", label: "Container" }, { key: "company", label: "Shipping line" }, { key: "bookings", label: "Bookings stuffed" }]} rows={byContainer} emptyText="No containers yet." /></div>
      )}
      {tab === "country" && (
        <div className="cc-card"><DataTable columns={[{ key: "country", label: "Country" }, { key: "count", label: "Bookings" }]} rows={byCountry} emptyText="No bookings yet." /></div>
      )}
      {tab === "customer" && (
        <div className="cc-card"><DataTable columns={[{ key: "sender", label: "Sender" }, { key: "count", label: "Bookings" }]} rows={byCustomer} emptyText="No bookings yet." /></div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* App shell                                                               */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [route, setRoute] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [employees, setEmployees] = useState(SEED.employees);
  const [senders, setSenders] = useState(SEED.senders);
  const [receivers, setReceivers] = useState(SEED.receivers);
  const [stores, setStores] = useState(SEED.stores);
  const [deliveryPartners, setDeliveryPartners] = useState(SEED.deliveryPartners);
  const [pickupPartners, setPickupPartners] = useState(SEED.pickupPartners);
  const [pricing, setPricing] = useState(SEED.pricing);
  const [pickupAssigns, setPickupAssigns] = useState(SEED.pickupAssigns);
  const [bookings, setBookings] = useState(SEED.bookings);
  const [containers, setContainers] = useState(SEED.containers);
  const [dailyExpenses, setDailyExpenses] = useState(SEED.dailyExpenses);
  const [creditNotes, setCreditNotes] = useState(SEED.creditNotes);
  const [bundleItems, setBundleItems] = useState({});
  const [stuffings, setStuffings] = useState([]);
  const [uaeStoreLog, setUaeStoreLog] = useState([]);

  const data = {
    employees, setEmployees, senders, setSenders, receivers, setReceivers,
    stores, setStores, deliveryPartners, setDeliveryPartners, pickupPartners, setPickupPartners,
    pricing, setPricing, pickupAssigns, setPickupAssigns, bookings, setBookings,
    containers, setContainers, dailyExpenses, setDailyExpenses, creditNotes, setCreditNotes,
    bundleItems, setBundleItems, stuffings, setStuffings, uaeStoreLog, setUaeStoreLog,
  };

  const go = (key) => { setRoute(key); setSidebarOpen(false); };
  const [title, subtitle] = TITLES[route];

  let body;
  if (route === "dashboard") body = <Dashboard data={data} />;
  else if (route === "team") body = (
    <MasterView title="Team" desc="Admins and employees" idPrefix="EMP" dupFields={["empId"]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "empId", label: "Employee ID", required: true },
        { key: "contact", label: "Contact number", required: true },
        { key: "bloodGroup", label: "Blood group" },
        { key: "role", label: "Role", type: "select", options: ["Admin", "Employee"], required: true },
      ]}
      columns={[{ key: "name", label: "Name" }, { key: "empId", label: "Employee ID" }, { key: "contact", label: "Contact" }, { key: "bloodGroup", label: "Blood group" }, { key: "role", label: "Role" }]}
      rows={employees} setRows={setEmployees}
    />
  );
  else if (route === "customers") body = <Customers data={data} />;
  else if (route === "stores") body = (
    <MasterView title="Stores" desc="Warehouse locations" idPrefix="STR" dupFields={["location"]}
      fields={[
        { key: "location", label: "Location", required: true },
        { key: "contact", label: "Contact number", required: true },
        { key: "inCharge", label: "Store in charge", required: true },
      ]}
      columns={[{ key: "id", label: "Store ID" }, { key: "location", label: "Location" }, { key: "contact", label: "Contact" }, { key: "inCharge", label: "In charge" }]}
      rows={stores} setRows={setStores}
    />
  );
  else if (route === "deliveryPartners") body = (
    <MasterView title="Delivery partners" desc="Last-mile delivery vendors" idPrefix="DLV" dupFields={["whatsapp"]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "whatsapp", label: "WhatsApp number", required: true },
        { key: "from", label: "From" },
        { key: "toCountry", label: "To country" },
        { key: "charge", label: "Delivery charge", type: "number" },
      ]}
      columns={[{ key: "name", label: "Name" }, { key: "whatsapp", label: "WhatsApp" }, { key: "from", label: "From" }, { key: "toCountry", label: "To country" }, { key: "charge", label: "Charge", render: (r) => money(r.charge) }]}
      rows={deliveryPartners} setRows={setDeliveryPartners}
    />
  );
  else if (route === "pickupPartners") body = (
    <MasterView title="Pickup partners" desc="Third-party collection partners" idPrefix="PCK" dupFields={["whatsapp"]}
      fields={[{ key: "name", label: "Name", required: true }, { key: "whatsapp", label: "WhatsApp number", required: true }]}
      columns={[{ key: "name", label: "Name" }, { key: "whatsapp", label: "WhatsApp" }]}
      rows={pickupPartners} setRows={setPickupPartners}
    />
  );
  else if (route === "pricing") body = (
    <MasterView title="Pricing" desc="Route-wise price per unit" idPrefix="PRC" dupFields={["from", "to", "uom"]} hasStatus={false}
      fields={[
        { key: "from", label: "From", required: true },
        { key: "to", label: "To", required: true },
        { key: "uom", label: "Unit of measure", type: "select", options: ["Kg", "Bundle", "Box", "Pallet"], required: true },
        { key: "price", label: "Price", type: "number", required: true },
      ]}
      columns={[{ key: "from", label: "From" }, { key: "to", label: "To" }, { key: "uom", label: "UOM" }, { key: "price", label: "Price", render: (r) => money(r.price) }]}
      rows={pricing} setRows={setPricing}
    />
  );
  else if (route === "pickupAssign") body = (
    <MasterView title="Pickup assign" desc="Assign a transport to a collection run" idPrefix="PKA" dupFields={["lrNo"]}
      fields={[
        { key: "transport", label: "Choose transport", type: "select", options: [...pickupPartners.map((p) => p.name), ...deliveryPartners.map((d) => d.name)], required: true },
        { key: "lrNo", label: "LR number", required: true },
      ]}
      columns={[{ key: "transport", label: "Transport" }, { key: "lrNo", label: "LR No" }]}
      rows={pickupAssigns} setRows={setPickupAssigns}
    />
  );
  else if (route === "booking") body = <BookingModule data={data} />;
  else if (route === "readyToShip") body = <BundleWorkspace mode="ready" data={data} />;
  else if (route === "repacking") body = <BundleWorkspace mode="repack" data={data} />;
  else if (route === "containers") body = (
    <MasterView title="Containers" desc="Containers moving between Kochi and the UAE" idPrefix="CNT" dupFields={["company", "stuffingDate"]}
      fields={[
        { key: "company", label: "Shipping line / company", required: true },
        { key: "stuffingDate", label: "Stuffing date", type: "date", required: true },
        { key: "cutOffDate", label: "Cut-off date", type: "date" },
        { key: "etaCok", label: "ETA Kochi", type: "date" },
        { key: "etdCok", label: "ETD Kochi", type: "date" },
        { key: "etaUae", label: "ETA UAE", type: "date" },
      ]}
      columns={[
        { key: "company", label: "Company" }, { key: "stuffingDate", label: "Stuffing", render: (r) => fmtDate(r.stuffingDate) },
        { key: "cutOffDate", label: "Cut-off", render: (r) => fmtDate(r.cutOffDate) }, { key: "etaCok", label: "ETA COK", render: (r) => fmtDate(r.etaCok) },
        { key: "etdCok", label: "ETD COK", render: (r) => fmtDate(r.etdCok) }, { key: "etaUae", label: "ETA UAE", render: (r) => fmtDate(r.etaUae) },
      ]}
      rows={containers} setRows={setContainers}
    />
  );
  else if (route === "stuffing") body = <StuffingModule data={data} />;
  else if (route === "invoicing") body = <InvoicingModule data={data} />;
  else if (route === "creditNote") body = <CreditNoteModule data={data} />;
  else if (route === "expenses") body = (
    <MasterView title="Daily expense" desc="Day-to-day operational spends" idPrefix="EXP" hasStatus={false}
      fields={[
        { key: "date", label: "Date", type: "date", required: true },
        { key: "type", label: "Expense type", required: true },
        { key: "paymentType", label: "Payment type", type: "select", options: ["Cash", "UPI"], required: true },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "description", label: "Description", type: "textarea" },
      ]}
      columns={[{ key: "date", label: "Date", render: (r) => fmtDate(r.date) }, { key: "type", label: "Type" }, { key: "paymentType", label: "Payment" }, { key: "amount", label: "Amount", render: (r) => money(r.amount) }, { key: "description", label: "Description" }]}
      rows={dailyExpenses} setRows={setDailyExpenses}
      footer={(rows) => <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", fontSize: 13, fontWeight: 600 }}>Total: {money(rows.reduce((s, r) => s + Number(r.amount || 0), 0))}</div>}
    />
  );
  else if (route === "reports") body = <ReportsModule data={data} />;

  return (
    <div className="cc-root">
      <style>{CSS}</style>
      <aside className={`cc-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="cc-brand">
          <div className="cc-brand-mark"><Ship size={18} color="#2A1600" /></div>
          <div>
            <div className="cc-brand-name cc-h">Cargo console</div>
            <div className="cc-brand-sub">Kochi ⇄ UAE</div>
          </div>
        </div>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="cc-navgroup-label">{g.group}</div>
            {g.items.map((it) => (
              <button key={it.key} className={`cc-navitem ${route === it.key ? "active" : ""}`} onClick={() => go(it.key)}>
                <it.icon size={16} /> {it.label}
              </button>
            ))}
          </div>
        ))}
      </aside>
      <div className="cc-main">
        <div className="cc-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="cc-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div>
              <div className="cc-topbar-title cc-h">{title}</div>
              <div className="cc-topbar-sub">{subtitle}</div>
            </div>
          </div>
          <div className="cc-avatar">A</div>
        </div>
        <div className="cc-content">{body}</div>
      </div>
    </div>
  );
}
