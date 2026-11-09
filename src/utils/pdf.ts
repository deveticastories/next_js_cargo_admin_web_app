/**
 * Report PDFs (packing list, container lists, table exports) in the mobile app's form layout
 * (rn_cargo_mobile_app's pdfFrame.ts + tablePdf.ts): one black-ruled box with the Introlines
 * logo, the title band, the document's content, then the office address and "Authorised
 * Signature". Drawn as real vector text with jsPDF (not a screenshot), so long tables carry on to
 * further framed pages. The Invoice and Delivery note use the company's printed forms (formPdf.ts).
 * jsPDF's standard fonts only cover Latin-1, so amounts print as "AED".
 */

import type { UserOptions } from "jspdf-autotable";

/** "AED 1,234.5" — the mobile app's PDF amount format. */
export const pdfMoney = (n: number | string | undefined): string =>
  `AED ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export interface PartyDetails {
  name: string;
  lines: string[];
}

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

/** A table cell: plain text, or text printed in a colour (e.g. a place's colour). */
export type PdfCell = string | { text: string; color?: string };

const cellOf = (c: PdfCell) =>
  typeof c === "string" ? latin1(c) : { content: latin1(c.text), styles: c.color ? { textColor: c.color } : {} };

/** What a framed document's content is drawn with. */
interface Frame {
  doc: import("jspdf").jsPDF;
  /** A ruled table under the content so far; `gap` is the space above it (mm). */
  table: (opts: UserOptions & { gap?: number }) => void;
  /** A bold sub-heading, like the app's `<h3>`. */
  heading: (text: string) => void;
  /** An italic note under the content, like the app's `.footnote`. */
  note: (text: string) => void;
}

/**
 * One framed document: `draw` lays out the content; long content carries on to further framed
 * pages (logo, title and table header repeat), and the address and signature close the last page.
 */
async function downloadFramed(filename: string, title: string, landscape: boolean, draw: (f: Frame) => void): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, { LOGO_DATA_URI }, icons] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("./pdfLogo"),
    Promise.all(FRAME_CONTACTS.map(([k]) => iconPng(CONTACT_ICONS[k]))),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: landscape ? "landscape" : "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const frameX = FRAME_MARGIN;
  const frameW = pageW - FRAME_MARGIN * 2;
  const contentX = frameX + PAD;
  const contentTop = FRAME_MARGIN + LOGO_BAND + TITLE_BAND + PAD;
  const bottomLimit = pageH - FRAME_MARGIN - PAD;
  const fontSize = landscape ? 8.5 : 10;
  const cell = {
    font: "helvetica",
    fontSize,
    textColor: 0,
    lineColor: 0,
    lineWidth: 0.2,
    cellPadding: landscape ? { top: 1.3, bottom: 1.3, left: 1.6, right: 1.6 } : { top: 1.6, bottom: 1.6, left: 2, right: 2 },
    valign: "top" as const,
  };
  const bold = { fontStyle: "bold" as const, fillColor: 255 as const };
  const margin = { left: contentX, right: contentX, top: contentTop, bottom: pageH - bottomLimit };
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  let y = contentTop;
  /** Starts a new page when `h` mm doesn't fit under the content so far. */
  const room = (h: number) => {
    if (y + h <= bottomLimit) return;
    doc.addPage();
    y = contentTop;
  };
  draw({
    doc,
    table: ({ gap = 0, styles, headStyles, footStyles, ...opts }) => {
      autoTable(doc, {
        startY: y + gap,
        theme: "grid",
        styles: { ...cell, ...styles },
        headStyles: { ...bold, halign: "center", ...headStyles },
        footStyles: { ...bold, ...footStyles },
        showHead: "everyPage",
        rowPageBreak: "avoid",
        margin,
        ...opts,
      });
      y = lastY();
    },
    heading: (text) => {
      y += 4.2;
      room(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(latin1(text), contentX, y + 3.9);
      y += 5.5;
    },
    note: (text) => {
      y += 1.6;
      room(5);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(0);
      const lines = doc.splitTextToSize(latin1(text), pageW - contentX * 2) as string[];
      doc.text(lines, contentX, y + 3.2);
      y += lines.length * 3.8 + 1;
    },
  });

  // Address + signature after the content — on a fresh page when they don't fit under it.
  const lineH = 3.6;
  const footerH = 7 + FRAME_CONTACTS.reduce((h, [, lines]) => h + lines.length * lineH + 3.2, 0) + 5;
  let footY = y + 7;
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
    doc.text(latin1(title.toUpperCase()), pageW / 2, FRAME_MARGIN + LOGO_BAND + TITLE_BAND / 2, { align: "center", baseline: "middle" });
  }
  doc.save(filename);
}

// ---------------------------------------------------------------------------
// Table report — the app's downloadTablePdf.
// ---------------------------------------------------------------------------

export interface FramedTablePdf {
  title: string;
  /** Label/value rows of the details table above the main table (first page only). */
  info: [string, PdfCell][];
  head: string[];
  body: PdfCell[][];
  /** Optional totals row, same length as `head` (last page only). */
  foot?: string[];
  /** Wide reports (many columns) print on landscape A4 with a smaller font, like the app's. */
  landscape?: boolean;
}

/** A table report: a details table (label/value rows), then the main table with its totals. */
export const downloadFramedTablePdf = (filename: string, pdf: FramedTablePdf): Promise<void> =>
  downloadFramed(filename, pdf.title, !!pdf.landscape, (f) => {
    if (pdf.info.length) {
      f.table({
        tableWidth: "wrap",
        styles: { minCellWidth: 40 },
        columnStyles: { 0: { fontStyle: "bold" } },
        body: pdf.info.map(([k, v]) => [latin1(k), cellOf(v)]),
      });
    }
    f.table({
      gap: pdf.info.length ? PAD : 0,
      head: [pdf.head.map(latin1)],
      body: pdf.body.length ? pdf.body.map((r) => r.map(cellOf)) : [[{ content: "-", colSpan: pdf.head.length }]],
      ...(pdf.foot ? { foot: [pdf.foot.map(latin1)], showFoot: "lastPage" as const } : {}),
    });
  });

/** Same as the app's downloadTablePdf. */
export const downloadTablePdf = downloadFramedTablePdf;

// ---------------------------------------------------------------------------
// Packing list — the app's packingListSheet.
// ---------------------------------------------------------------------------

export interface PackingListData {
  lrNo: string;
  bookingDate: string;
  sender: PartyDetails;
  receiver: PartyDetails;
  /** `product`: "Shirt - Cotton"; `qty`: the quantity with its unit, e.g. "40 Pcs". */
  bundles: { bundleNo: number; items: { product: string; qty: string }[] }[];
}

/** One row per product, the bundle number spanning its products. */
export const downloadPackingListPdf = (filename: string, p: PackingListData): Promise<void> =>
  downloadFramed(filename, "PACKING LIST", false, (f) => {
    const half = (f.doc.internal.pageSize.getWidth() - (FRAME_MARGIN + PAD) * 2) / 2;
    const party = (x: PartyDetails) => latin1([x.name, ...x.lines.filter(Boolean)].join("\n"));
    let totalQty = 0;
    const body = p.bundles.flatMap((b) => {
      const items = b.items.length ? b.items : [{ product: "", qty: "" }];
      return items.map((it, i) => {
        totalQty += parseFloat(it.qty) || 0;
        const row: (string | { content: string; rowSpan: number; styles: { valign: "middle" } })[] = [];
        if (i === 0) row.push({ content: String(b.bundleNo), rowSpan: items.length, styles: { valign: "middle" } });
        row.push(latin1(it.product), latin1(it.qty));
        return row;
      });
    });
    f.table({
      body: [["LR No.", latin1(p.lrNo), "Booking Date", latin1(p.bookingDate)]],
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 }, 1: { cellWidth: 48 }, 2: { fontStyle: "bold", cellWidth: 38 } },
    });
    f.table({
      gap: 4.8,
      head: [["Sender Name & Details", "Customer Name (Receiver Name & Details)"]],
      body: [[party(p.sender), party(p.receiver)]],
      bodyStyles: { minCellHeight: 26 },
      // Two equal halves, like the app's form.
      columnStyles: { 0: { cellWidth: half }, 1: { cellWidth: half } },
    });
    f.heading("Description");
    f.table({
      head: [["Bundle No", "Products", "Product Qty"]],
      body,
      foot: [[{ content: "Total Qty", colSpan: 2 }, totalQty ? String(totalQty) : ""]],
      showFoot: "lastPage",
      columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 32 } },
    });
    f.note("Note: Each Bundle No covers all product lines listed beside it; add more rows under the same bundle for additional products.");
  });
