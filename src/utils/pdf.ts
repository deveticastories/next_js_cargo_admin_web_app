/**
 * PDF documents for the Invoicing screen — Invoice and Delivery note share one
 * letterhead/table style (company header, grey-headed bordered tables, signature
 * line). Built with jsPDF's standard fonts, so text is kept to plain Latin
 * characters (amounts print as "Rs." rather than the rupee sign).
 */

const COMPANY = "INTROLINES PVT LTD";
const CONTACT = "Mob: +91 86818 00075   |   Email: info@introlines.in";
const GREY: [number, number, number] = [217, 217, 217];
const BORDER: [number, number, number] = [150, 150, 150];
const MARGIN = 15;

export const pdfMoney = (n: number | string | undefined): string =>
  `Rs. ${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export interface PartyDetails {
  name: string;
  lines: string[];
}

interface Doc {
  doc: import("jspdf").jsPDF;
  autoTable: typeof import("jspdf-autotable").default;
}

async function newDoc(title: string): Promise<Doc> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text(COMPANY, MARGIN, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(CONTACT, MARGIN, 30.5);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text(title, MARGIN, 39);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 40.3, MARGIN + doc.getTextWidth(title), 40.3);
  return { doc, autoTable };
}

const baseStyles = {
  font: "times",
  fontSize: 11,
  textColor: 20,
  lineColor: BORDER,
  lineWidth: 0.2,
  cellPadding: 2.4,
} as const;

const headStyles = { fillColor: GREY, textColor: 0, fontStyle: "bold", lineColor: BORDER, lineWidth: 0.2 } as const;

/** Two-line-item table of label/value cells across the page, e.g. "LR No. | value | Booking Date | value". */
function infoRow(d: Doc, y: number, cells: [string, string, string, string]): number {
  d.autoTable(d.doc, {
    startY: y,
    theme: "grid",
    styles: baseStyles,
    body: [[cells[0], cells[1], cells[2], cells[3]]],
    columnStyles: {
      0: { fillColor: GREY, fontStyle: "bold", cellWidth: 38 },
      1: { cellWidth: 48 },
      2: { fillColor: GREY, fontStyle: "bold", cellWidth: 38 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });
  return (d.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function partyBoxes(d: Doc, y: number, from: PartyDetails, to: PartyDetails, toLabel = "To / Customer Name (Receiver Name & Details)"): number {
  const text = (p: PartyDetails) => [p.name, ...p.lines.filter(Boolean)].join("\n");
  d.autoTable(d.doc, {
    startY: y,
    theme: "grid",
    styles: baseStyles,
    head: [["From (Sender Name & Details)", toLabel]],
    headStyles,
    body: [[text(from), text(to)]],
    bodyStyles: { minCellHeight: 32, valign: "top" },
    margin: { left: MARGIN, right: MARGIN },
  });
  return (d.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function signatures(d: Doc, y: number, left: string, right: string) {
  d.doc.setFont("times", "normal");
  d.doc.setFontSize(11);
  d.doc.text(left, MARGIN + 2, y);
  d.doc.text(right, 110, y);
}

export interface DeliveryNoteData {
  lrNo: string;
  bookingDate: string;
  sender: PartyDetails;
  receiver: PartyDetails;
  rows: { bundleNo: string; product: string; qty: string }[];
}

export async function downloadDeliveryNotePdf(filename: string, data: DeliveryNoteData): Promise<void> {
  const d = await newDoc("DELIVERY NOTE");
  let y = infoRow(d, 44, ["LR No.", data.lrNo, "Booking Date", data.bookingDate]);
  y = partyBoxes(d, y + 8, data.sender, data.receiver);

  d.doc.setFont("times", "bold");
  d.doc.setFontSize(13);
  d.doc.text("Description", MARGIN, y + 11);
  const totalQty = data.rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  // Always at least 10 rows so the sheet still reads as a form when the list is short.
  const body = [...data.rows.map((r) => [r.bundleNo, r.product, r.qty])];
  while (body.length < 10) body.push(["", "", ""]);
  d.autoTable(d.doc, {
    startY: y + 13,
    theme: "grid",
    styles: baseStyles,
    head: [["Bundle No", "Products", "Qty"]],
    headStyles,
    body,
    foot: [[{ content: "Total Qty", colSpan: 2 }, String(totalQty || "")]],
    footStyles: headStyles,
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 30 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  const end = (d.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  signatures(d, Math.min(end + 22, 285), "Delivery Boy Name & Signature", "Receiver Name & Signature");
  d.doc.save(filename);
}

export interface InvoiceData {
  invoiceNo: string;
  bookingDate: string;
  receiver: PartyDetails;
  /** Numbered charge rows (freight, discount, delivery…). Rate/qty are left blank for rows that don't have them. */
  rows: { description: string; rate?: number; qty?: number; amount: number }[];
  /** Conditional extra-charge lines — printed with their condition, amount left blank when 0/undefined. */
  extraCharges: { withoutBill?: number; brandHandling?: number; bundleHandling?: number; gccTransport?: number };
  total: number;
}

const signedMoney = (n: number) => (n < 0 ? `- ${pdfMoney(-n)}` : pdfMoney(n));

export async function downloadInvoicePdf(filename: string, data: InvoiceData): Promise<void> {
  const d = await newDoc("INVOICE");
  let y = infoRow(d, 44, ["Invoice No.", data.invoiceNo, "Booking Date", data.bookingDate]);

  d.autoTable(d.doc, {
    startY: y + 8,
    theme: "grid",
    styles: baseStyles,
    head: [["Customer Name (Receiver Name & Details)"]],
    headStyles,
    body: [[[data.receiver.name, ...data.receiver.lines.filter(Boolean)].join("\n")]],
    bodyStyles: { minCellHeight: 30, valign: "top" },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (d.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  d.doc.setFont("times", "bold");
  d.doc.setFontSize(13);
  d.doc.text("Description", MARGIN, y + 11);

  // At least 6 numbered rows so the sheet still reads as a form when there are fewer charges.
  const numbered: string[][] = data.rows.map((r, i) => [
    String(i + 1),
    r.description,
    r.rate !== undefined ? pdfMoney(r.rate) : "",
    r.qty !== undefined ? String(r.qty) : "",
    signedMoney(r.amount),
  ]);
  while (numbered.length < 6) numbered.push([String(numbered.length + 1), "", "", "", ""]);
  const extra = (label: string, note: string, amount?: number) => [
    { content: `${label}  (${note})`, colSpan: 4, styles: { fontStyle: "italic" as const } },
    amount ? pdfMoney(amount) : "",
  ];
  d.autoTable(d.doc, {
    startY: y + 13,
    theme: "grid",
    styles: baseStyles,
    head: [["SL No", "Bundles", "Rate (per Bundle)", "Qty", "Amount"]],
    headStyles,
    body: [
      ...numbered,
      extra("Without Bill Extra Charge", "applicable only if sent without bill", data.extraCharges.withoutBill),
      extra("Brand Handling Charge", "applicable only for branded products", data.extraCharges.brandHandling),
      extra("Bundle Handling Charge", "applicable only if below 5 bundles", data.extraCharges.bundleHandling),
      extra("GCC Transport Charge", "applicable only for delivery outside UAE", data.extraCharges.gccTransport),
    ],
    foot: [
      [{ content: "Total Amount", colSpan: 4 }, pdfMoney(data.total)],
      [{ content: "Payable Amount", colSpan: 4 }, pdfMoney(data.total)],
    ],
    footStyles: headStyles,
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 18 }, 2: { cellWidth: 38 }, 3: { cellWidth: 26 }, 4: { cellWidth: 36 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  const end = (d.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  d.doc.setFont("times", "italic");
  d.doc.setFontSize(9.5);
  d.doc.text("Note: Additional charge lines above apply only under their stated condition; otherwise leave blank/remove before sending.", MARGIN, end + 5);
  signatures(d, Math.min(end + 24, 285), "Authorised Person Name & Signature", "");
  d.doc.save(filename);
}

export interface PackingListData {
  lrNo: string;
  bookingDate: string;
  sender: PartyDetails;
  receiver: PartyDetails;
  bundles: { bundleNo: number; items: { product: string; qty: string }[] }[];
}

/** Packing list — each Bundle No spans all of that bundle's product lines. */
export async function downloadPackingListPdf(filename: string, data: PackingListData): Promise<void> {
  const d = await newDoc("PACKING LIST");
  let y = infoRow(d, 44, ["LR No.", data.lrNo, "Booking Date", data.bookingDate]);
  y = partyBoxes(d, y + 8, data.sender, data.receiver, "Customer Name (Receiver Name & Details)");

  d.doc.setFont("times", "bold");
  d.doc.setFontSize(13);
  d.doc.text("Description", MARGIN, y + 11);
  const body: (string | { content: string; rowSpan: number; styles?: { valign: "middle" } })[][] = [];
  let totalQty = 0;
  for (const b of data.bundles) {
    const items = b.items.length ? b.items : [{ product: "", qty: "" }];
    items.forEach((item, i) => {
      totalQty += Number(item.qty) || 0;
      const row: (string | { content: string; rowSpan: number; styles?: { valign: "middle" } })[] = [];
      if (i === 0) row.push({ content: String(b.bundleNo), rowSpan: items.length, styles: { valign: "middle" } });
      row.push(item.product, item.qty);
      body.push(row);
    });
  }
  d.autoTable(d.doc, {
    startY: y + 13,
    theme: "grid",
    styles: baseStyles,
    head: [["Bundle No", "Products", "Product Qty"]],
    headStyles,
    body,
    foot: [[{ content: "Total Qty", colSpan: 2 }, String(totalQty || "")]],
    footStyles: headStyles,
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 32 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  const end = (d.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  d.doc.setFont("times", "italic");
  d.doc.setFontSize(9.5);
  d.doc.text("Note: Each Bundle No covers all product lines listed beside it; add more rows under the same bundle for additional products.", MARGIN, end + 5);
  d.doc.save(filename);
}
