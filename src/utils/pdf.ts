/**
 * Report PDFs (packing list, container manifest, table exports) — one
 * letterhead/table style (company header, grey-headed bordered tables). The
 * Invoice and Delivery note use the company's printed forms instead (formPdf.ts).
 * Built with jsPDF's standard fonts, so text is kept to plain Latin characters
 * (amounts print as "AED").
 */

const COMPANY = "INTROLINES PVT LTD";
const CONTACT = "Mob: +91 86818 00075   |   Email: info@introlines.in";
const GREY: [number, number, number] = [217, 217, 217];
const BORDER: [number, number, number] = [150, 150, 150];
const MARGIN = 15;

export const pdfMoney = (n: number | string | undefined): string =>
  `AED ${Number(n || 0).toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;

export interface PartyDetails {
  name: string;
  lines: string[];
}

interface Doc {
  doc: import("jspdf").jsPDF;
  autoTable: typeof import("jspdf-autotable").default;
}

async function newDoc(title: string, orientation: "portrait" | "landscape" = "portrait"): Promise<Doc> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation });
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

export interface PackingListData {
  lrNo: string;
  bookingDate: string;
  sender: PartyDetails;
  receiver: PartyDetails;
  bundles: {
    bundleNo: number;
    bundleMarkId?: number;
    netWeight: string;
    grossWeight: string;
    items: { product: string; qty: string; unit: string; fabric: string }[];
  }[];
}

type SpanCell = string | { content: string; rowSpan: number; styles?: { valign: "middle" } };

/** Packing list — each bundle's Sl No, Bundle Mark and weights span all of that bundle's product lines. */
export async function downloadPackingListPdf(filename: string, data: PackingListData): Promise<void> {
  const d = await newDoc("PACKING LIST");
  let y = infoRow(d, 44, ["LR No.", data.lrNo, "Booking Date", data.bookingDate]);
  y = partyBoxes(d, y + 8, data.sender, data.receiver, "Customer Name (Receiver Name & Details)");

  d.doc.setFont("times", "bold");
  d.doc.setFontSize(13);
  d.doc.text("Description", MARGIN, y + 11);
  const body: SpanCell[][] = [];
  let totalQty = 0;
  let totalNet = 0;
  let totalGross = 0;
  data.bundles.forEach((b, index) => {
    const items = b.items.length ? b.items : [{ product: "", qty: "", unit: "", fabric: "" }];
    totalNet += Number(b.netWeight) || 0;
    totalGross += Number(b.grossWeight) || 0;
    const span = (content: string): SpanCell => ({ content, rowSpan: items.length, styles: { valign: "middle" } });
    items.forEach((item, i) => {
      totalQty += Number(item.qty) || 0;
      const row: SpanCell[] = [];
      if (i === 0) row.push(span(String(index + 1)), span(b.bundleMarkId ? String(b.bundleMarkId) : "-"));
      row.push(item.product || "-", item.qty || "-", item.unit || "-", item.fabric || "-");
      if (i === 0) row.push(span(b.netWeight || "-"), span(b.grossWeight || "-"));
      body.push(row);
    });
  });
  d.autoTable(d.doc, {
    startY: y + 13,
    theme: "grid",
    styles: { ...baseStyles, fontSize: 10 },
    head: [["Sl No", "Bundle Mark", "Product Name", "Quantity", "Unit", "Fabric", "N.Wt", "Gr.Wt"]],
    headStyles,
    body,
    foot: [[{ content: "Total", colSpan: 3 }, String(totalQty || ""), "", "", String(totalNet || ""), String(totalGross || "")]],
    footStyles: headStyles,
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 22 }, 3: { cellWidth: 21 }, 4: { cellWidth: 20 }, 6: { cellWidth: 16 }, 7: { cellWidth: 16 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  const end = (d.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  d.doc.setFont("times", "italic");
  d.doc.setFontSize(9.5);
  d.doc.text("Note: Each bundle's Sl No, Bundle Mark and weights cover all product lines listed beside it.", MARGIN, end + 5);
  d.doc.save(filename);
}

export interface ContainerManifestData {
  containerCode: string;
  containerName: string;
  stuffedDate: string;
  rows: {
    bookingCode: string;
    sender: PartyDetails;
    receiver: PartyDetails;
    bundles: number;
    bundleMarks: string;
    receivableAmount?: number;
    deliveryPartnerAmount?: number;
    paymentStatus: string;
  }[];
}

/** Stuffing screen's container detail list — every booking loaded into one container. Landscape, to fit its nine columns. */
export async function downloadContainerManifestPdf(filename: string, data: ContainerManifestData): Promise<void> {
  const d = await newDoc("CONTAINER BOOKING LIST", "landscape");
  let y = infoRow(d, 44, ["Container ID", data.containerCode, "Container Name", data.containerName]);
  y = infoRow(d, y, ["Stuffed Date", data.stuffedDate, "No. of Bookings", String(data.rows.length)]);
  const party = (p: PartyDetails) => [p.name, ...p.lines.filter(Boolean)].join("\n");
  const amount = (n?: number) => (n === undefined ? "-" : pdfMoney(n));
  const sum = (pick: (r: ContainerManifestData["rows"][number]) => number | undefined) =>
    data.rows.reduce((total, r) => total + (pick(r) ?? 0), 0);
  d.autoTable(d.doc, {
    startY: y + 8,
    theme: "grid",
    styles: { ...baseStyles, fontSize: 9.5 },
    head: [["Sl No", "Booking ID", "Sender Details", "Receiver Details", "No. of Bundles", "Bundle Mark", "Total Receivable", "Delivery Partner Amt", "Payment Status"]],
    headStyles,
    body: data.rows.map((r, i) => [
      String(i + 1),
      r.bookingCode,
      party(r.sender),
      party(r.receiver),
      String(r.bundles),
      r.bundleMarks || "-",
      amount(r.receivableAmount),
      amount(r.deliveryPartnerAmount),
      r.paymentStatus,
    ]),
    foot: [
      [
        { content: "Total", colSpan: 4 },
        String(sum((r) => r.bundles)),
        "",
        pdfMoney(sum((r) => r.receivableAmount)),
        pdfMoney(sum((r) => r.deliveryPartnerAmount)),
        "",
      ],
    ],
    footStyles: headStyles,
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 12 }, 4: { cellWidth: 20 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  d.doc.save(filename);
}

export interface TablePdfData {
  title: string;
  /** Label/value pairs shown above the table, two per row. */
  info: [string, string][];
  head: string[];
  body: string[][];
  /** Optional totals row, same length as `head`. */
  foot?: string[];
}

/** Generic landscape letterhead + single table — the Stuffing screen's booking and bundle breakdowns. */
export async function downloadTablePdf(filename: string, data: TablePdfData): Promise<void> {
  const d = await newDoc(data.title, "landscape");
  let y = 44;
  for (let i = 0; i < data.info.length; i += 2) {
    const [a, b = ["", ""]] = [data.info[i], data.info[i + 1]];
    y = infoRow(d, y, [a[0], a[1], b[0], b[1]]);
  }
  d.autoTable(d.doc, {
    startY: y + 8,
    theme: "grid",
    // Wide tables (15 columns) need a smaller font to fit a landscape A4.
    styles: { ...baseStyles, fontSize: data.head.length > 10 ? 8 : 9.5, cellPadding: data.head.length > 10 ? 1.6 : 2.4 },
    head: [data.head],
    headStyles,
    body: data.body,
    // Keep each record on one page instead of splitting its wrapped cells across a page break.
    rowPageBreak: "avoid",
    ...(data.foot ? { foot: [data.foot], footStyles: headStyles, showFoot: "lastPage" as const } : {}),
    margin: { left: MARGIN, right: MARGIN },
  });
  d.doc.save(filename);
}

// ---------------------------------------------------------------------------
// Framed report — the mobile app's form layout (rn_cargo_mobile_app's pdfFrame.ts + tablePdf.ts):
// one black-ruled box with the Introlines logo, the title band, a details table and the main
// table, then the office address and "Authorised Signature". Drawn as real vector text (not a
// screenshot), so cells line up the same in every browser.
// ---------------------------------------------------------------------------

const FRAME_MARGIN = 12;
const LOGO_BAND = 24;
const TITLE_BAND = 10;
const PAD = 3.7;
const LOGO_RATIO = 463 / 163;

const iconSvg = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const CONTACT_ICONS = {
  pin: iconSvg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  phone: iconSvg(
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>'
  ),
  mail: iconSvg('<rect x="2" y="4" width="20" height="16" rx="1"/><path d="m2 6 10 7 10-7"/>'),
  globe: iconSvg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
};
const FRAME_CONTACTS: [keyof typeof CONTACT_ICONS, string[]][] = [
  ["pin", ["NO.25(2)/22, GROUND FLOOR, OPP VINAYAGAR KOVIL, KUMARAPURAM 1ST", "STREET RAYAPURAM, TIRUPPUR - 642601"]],
  ["phone", ["+91 8681800075"]],
  ["mail", ["info@introlines.in"]],
  ["globe", ["www.introlines.in"]],
];

/** The footer icons as PNGs — jsPDF can't place SVG, so each is rasterised once in the browser. */
async function iconPng(svg: string): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  canvas.getContext("2d")!.drawImage(img, 0, 0, 96, 96);
  return canvas.toDataURL("image/png");
}

/** jsPDF's standard fonts only cover Latin-1, so swap the dashes it can't draw. */
const latin1 = (s: string) => s.replace(/[‒-―]/g, "-");

export interface FramedTablePdf {
  title: string;
  /** Label/value rows of the details table above the main table (first page only). */
  info: [string, string][];
  head: string[];
  body: string[][];
  /** Optional totals row, same length as `head` (last page only). */
  foot?: string[];
  /** Wide reports (many columns) print on landscape A4 with a smaller font, like the app's. */
  landscape?: boolean;
}

/**
 * A table report in the app's framed form layout. Long tables carry on to further framed pages
 * (logo, title and table header repeat); the address and signature close the last page.
 */
export async function downloadFramedTablePdf(filename: string, pdf: FramedTablePdf): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, { LOGO_DATA_URI }, icons] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("./pdfLogo"),
    Promise.all(FRAME_CONTACTS.map(([k]) => iconPng(CONTACT_ICONS[k]))),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: pdf.landscape ? "landscape" : "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const frameX = FRAME_MARGIN;
  const frameW = pageW - FRAME_MARGIN * 2;
  const contentX = frameX + PAD;
  const contentTop = FRAME_MARGIN + LOGO_BAND + TITLE_BAND + PAD;
  const bottomLimit = pageH - FRAME_MARGIN - PAD;
  const fontSize = pdf.landscape ? 8.5 : 10;
  const cell = {
    font: "helvetica",
    fontSize,
    textColor: 0,
    lineColor: 0,
    lineWidth: 0.2,
    cellPadding: pdf.landscape ? { top: 1.3, bottom: 1.3, left: 1.6, right: 1.6 } : { top: 1.6, bottom: 1.6, left: 2, right: 2 },
    valign: "top" as const,
  };
  const bold = { fontStyle: "bold" as const, fillColor: 255 as const };
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Details table — label/value rows, sized to their text like the app's.
  let y = contentTop;
  if (pdf.info.length) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      tableWidth: "wrap",
      styles: { ...cell, minCellWidth: 40 },
      columnStyles: { 0: bold },
      body: pdf.info.map(([k, v]) => [latin1(k), latin1(v)]),
      margin: { left: contentX, right: contentX, top: contentTop, bottom: pageH - bottomLimit },
    });
    y = lastY() + PAD;
  }

  // Main table — header repeats on every page, totals on the last.
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: cell,
    headStyles: { ...bold, halign: "center" },
    footStyles: bold,
    head: [pdf.head.map(latin1)],
    body: pdf.body.length ? pdf.body.map((r) => r.map(latin1)) : [[{ content: "-", colSpan: pdf.head.length }]],
    ...(pdf.foot ? { foot: [pdf.foot.map(latin1)], showFoot: "lastPage" as const } : {}),
    showHead: "everyPage",
    rowPageBreak: "avoid",
    margin: { left: contentX, right: contentX, top: contentTop, bottom: pageH - bottomLimit },
  });

  // Address + signature after the table — on a fresh page when they don't fit under it.
  const lineH = 3.6;
  const footerH = 7 + FRAME_CONTACTS.reduce((h, [, lines]) => h + lines.length * lineH + 3.2, 0) + 5;
  let footY = lastY() + 7;
  if (footY + footerH > pageH - FRAME_MARGIN) {
    doc.addPage();
    footY = contentTop + 4;
  }
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  let cy = footY + 3;
  FRAME_CONTACTS.forEach(([, lines], i) => {
    doc.addImage(icons[i], "PNG", frameX + 8.5, cy - 2.6, 2.9, 2.9);
    doc.setFontSize(8);
    lines.forEach((l, n) => doc.text(l, frameX + 14.5, cy + n * lineH));
    cy += lines.length * lineH + 3.2;
  });
  doc.setFontSize(10.5);
  doc.text("Authorised Signature", frameX + frameW - 12, footY + 3, { align: "right" });
  const lastFrameBottom = cy + 3;

  // Frame, logo band and title band on every page; the last page's frame closes under the footer.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const bottom = p === pages ? lastFrameBottom : pageH - FRAME_MARGIN;
    doc.setDrawColor(0);
    doc.setLineWidth(0.42);
    doc.rect(frameX, FRAME_MARGIN, frameW, bottom - FRAME_MARGIN);
    doc.setLineWidth(0.28);
    doc.line(frameX, FRAME_MARGIN + LOGO_BAND, frameX + frameW, FRAME_MARGIN + LOGO_BAND);
    doc.line(frameX, FRAME_MARGIN + LOGO_BAND + TITLE_BAND, frameX + frameW, FRAME_MARGIN + LOGO_BAND + TITLE_BAND);
    const logoH = 20.5;
    doc.addImage(LOGO_DATA_URI, "PNG", pageW / 2 - (logoH * LOGO_RATIO) / 2, FRAME_MARGIN + 1.6, logoH * LOGO_RATIO, logoH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(latin1(pdf.title.toUpperCase()), pageW / 2, FRAME_MARGIN + LOGO_BAND + TITLE_BAND / 2, { align: "center", baseline: "middle" });
  }
  doc.save(filename);
}
