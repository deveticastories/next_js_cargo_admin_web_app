/**
 * The company's printed Invoice and Delivery note forms — the same HTML layout
 * and content as the mobile app (rn_cargo_mobile_app's invoiceFormPdf.ts and
 * tablePdf.ts), rendered in the browser with html2canvas and saved as an A4 PDF
 * through jsPDF, one page per sheet.
 */
import { LOGO_DATA_URI } from "./pdfLogo";

export interface PartyDetails {
  name: string;
  lines: string[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Renders each `<section class="sheet">` of the HTML onto its own A4 page and downloads the PDF. */
async function downloadSheetsPdf(filename: string, style: string, sheets: string[], marginMm: number): Promise<void> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const contentWidth = 210 - marginMm * 2;
  const contentHeight = 297 - marginMm * 2;
  // Off-screen iframe at the printable width, so the sheets lay out exactly as on paper.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${contentWidth}mm;height:${contentHeight}mm;border:0;visibility:hidden;`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"/><style>${style} body { background: #fff; }</style></head><body>${sheets.join("")}</body></html>`);
    doc.close();
    await Promise.all(
      Array.from(doc.images).map((img) => (img.complete ? Promise.resolve() : new Promise((done) => ((img.onload = done), (img.onerror = done)))))
    );
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const nodes = Array.from(doc.querySelectorAll<HTMLElement>("section.sheet"));
    for (let i = 0; i < nodes.length; i++) {
      const canvas = await html2canvas(nodes[i], { scale: 2, backgroundColor: "#ffffff", logging: false });
      let w = contentWidth;
      let h = (canvas.height * w) / canvas.width;
      // A sheet taller than the page is shrunk to fit rather than cut off.
      if (h > contentHeight) {
        w = (w * contentHeight) / h;
        h = contentHeight;
      }
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", marginMm + (contentWidth - w) / 2, marginMm, w, h);
    }
    pdf.save(filename);
  } finally {
    frame.remove();
  }
}

// ---------------------------------------------------------------------------
// Invoice — the company's printed invoice form (INVOICE.pdf).
// ---------------------------------------------------------------------------

export interface InvoiceSheet {
  consignee: PartyDetails;
  date: string;
  invoiceNo: string;
  mark: string;
  packages: string;
  /** `pieces`: one line per product, e.g. "Shirt – 40 pcs". Charge rows leave commodity empty. */
  rows: { commodity?: string; pieces?: string[]; particular: string; qty?: number; rate?: number; amount?: number }[];
  /** Printed total; defaults to the sum of the row amounts. */
  total?: number;
}

const amount = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ONES = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

/** 1500 → "ONE THOUSAND FIVE HUNDRED", as printed on the invoice. */
function inWords(n: number): string {
  const below1000 = (x: number): string => {
    const parts: string[] = [];
    if (x >= 100) parts.push(`${ONES[Math.floor(x / 100)]} HUNDRED`);
    const r = x % 100;
    if (r >= 20) parts.push([TENS[Math.floor(r / 10)], ONES[r % 10]].filter(Boolean).join(" "));
    else if (r > 0) parts.push(ONES[r]);
    return parts.join(" ");
  };
  const whole = Math.floor(n);
  if (whole === 0) return "ZERO";
  const scales: [number, string][] = [
    [1_000_000_000, "BILLION"],
    [1_000_000, "MILLION"],
    [1_000, "THOUSAND"],
  ];
  let rest = whole;
  const words: string[] = [];
  for (const [size, name] of scales) {
    if (rest >= size) {
      words.push(`${below1000(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) words.push(below1000(rest));
  const fils = Math.round((n - whole) * 100);
  return words.join(" ") + (fils ? ` AND ${below1000(fils)} FILS` : "");
}

const INVOICE_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 9.5pt; margin: 0; }
  .sheet { border: 1.2pt solid #000; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 0.7pt solid #000; padding: 4px 6px; vertical-align: top; text-align: left; }
  .logo { text-align: center; padding: 6px 0 2px; border-bottom: 0.8pt solid #000; }
  .logo img { height: 74px; }
  .title { text-align: center; font-weight: bold; font-size: 13pt; padding: 7px 0; border-bottom: 0.8pt solid #000; }
  .head td { border-top: none; }
  .head td:first-child { border-left: none; }
  .head td:last-child { border-right: none; }
  .b { font-weight: bold; }
  .c { text-align: center; }
  .r { text-align: right; }
  .items td:first-child { border-left: none; }
  .items td:last-child { border-right: none; }
  .items th { text-align: center; font-weight: bold; }
  .items td { height: 26px; }
  .items .filler td { height: auto; border-top: none; border-bottom: none; }
  .wide td:first-child { border-left: none; }
  .wide td:last-child { border-right: none; }
  .bank td { font-size: 8pt; font-weight: bold; line-height: 1.45; height: 92px; }
  .foot { text-align: center; font-size: 8.5pt; padding: 8px 6px; line-height: 1.5; }
`;

function invoiceSheetHtml(s: InvoiceSheet): string {
  const total = s.total ?? s.rows.reduce((n, r) => n + (r.amount ?? 0), 0);
  const consignee = [`<span style="font-size:11pt">${esc(s.consignee.name)}</span>`, ...s.consignee.lines.filter(Boolean).map(esc)].join("<br/>");
  const rows = s.rows
    .map(
      (r, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${r.commodity ? `<b>${esc(r.commodity)}</b>` : ""}${(r.pieces ?? []).map((p) => `<br/>${esc(p)}`).join("")}</td>
        <td>${esc(r.particular)}</td>
        <td class="c">${r.qty || ""}</td>
        <td class="r">${r.rate !== undefined ? amount(r.rate) : ""}</td>
        <td class="r">${r.amount !== undefined ? (r.amount < 0 ? `-${amount(-r.amount)}` : amount(r.amount)) : ""}</td>
      </tr>`
    )
    .join("");
  // Keep the item block tall like the printed form when there are only a few rows.
  const filler = Math.max(0, 7 - s.rows.length) * 26;
  return `<section class="sheet">
  <div class="logo"><img src="${LOGO_DATA_URI}" alt="Introlines Merchant Exports"/></div>
  <div class="title">INVOICE</div>
  <table class="head">
    <tr><td class="b" style="width:60%">CONSIGNEE DETAILS</td><td class="b" style="width:14%">Date</td><td>${esc(s.date)}</td></tr>
    <tr><td rowspan="3" style="font-size:10.5pt;line-height:1.5">${consignee}</td><td class="b">Invoice No</td><td>${esc(s.invoiceNo)}</td></tr>
    <tr><td>MARK</td><td>${esc(s.mark)}</td></tr>
    <tr><td class="b">Packages</td><td>${esc(s.packages)}</td></tr>
  </table>
  <table class="items">
    <thead><tr>
      <th style="width:9%;border-left:none">SI</th><th style="width:25%">Commodity &amp; Pcs</th><th style="width:25%">Particular</th>
      <th style="width:11%">QTY</th><th style="width:14%">Rate per Box</th><th style="width:16%;border-right:none">Amount<br/>(AED)</th>
    </tr></thead>
    <tbody>${rows}${filler ? `<tr class="filler"><td style="height:${filler}px"></td><td></td><td></td><td></td><td></td><td></td></tr>` : ""}</tbody>
  </table>
  <table class="wide">
    <tr><td class="b r" style="padding-right:30px">TOTAL AMOUNT(AED) &nbsp;&nbsp;&nbsp;&nbsp; ${amount(total)}</td></tr>
    <tr><td class="b r" style="padding-right:30px;font-size:8.5pt">Amount Collected From India()</td></tr>
  </table>
  <table class="wide">
    <tr>
      <td class="b c" style="width:72%;padding:14px 6px">Amount in words: ${inWords(total)} (AED) ONLY</td>
      <td class="b c" style="padding:14px 6px;border-right:none">Amount to be collected<br/>${amount(total)}</td>
    </tr>
  </table>
  <table class="wide">
    <tr><td class="b c" style="width:35%">INDIA</td><td class="b c" style="width:37%">DUBAI</td><td class="b c">SIGNATURE</td></tr>
    <tr class="bank">
      <td>A/C NAME : INTROLINES PRIVATE LIMITED<br/>A/C NO : 922020041854324<br/>IFSC CODE : UTIB0000210<br/>SWIFT CODE : AXISNBB210<br/>AD CODE : 63601999200017</td>
      <td>A/C NAME : AL ZAI ALANIQ TRADING<br/>A/C NO : 0373224910001<br/>IBAN : AE570400000373224910001<br/>BANK NAME: RAK BANK</td>
      <td></td>
    </tr>
  </table>
  <div class="foot">NO.25(2)/22, GROUND FLOOR, OPP VINAYAGAR KOVIL, KUMARAPURAM 1ST STREET RAYAPURAM, TIRUPPUR – 642601<br/>www.introlines.in</div>
</section>`;
}

/** Invoice form pages, one per sheet, saved as `filename`. */
export const downloadInvoiceFormPdf = (filename: string, sheets: InvoiceSheet[]) =>
  downloadSheetsPdf(filename, INVOICE_STYLE, sheets.map(invoiceSheetHtml), 12);

// ---------------------------------------------------------------------------
// Delivery note — the company's printed delivery note form (DELVRY NOTE.pdf).
// ---------------------------------------------------------------------------

export interface DeliveryNoteData {
  lrNo: string;
  receiver: PartyDetails;
  rows: { bundleNo: string; product: string; qty: string }[];
}

const DELIVERY_NOTE_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 10pt; margin: 0; }
  .box { border: 1.2pt solid #000; }
  .logo { text-align: center; padding: 10px 8px 4px; border-bottom: 0.8pt solid #000; position: relative; }
  .logo img { height: 66px; }
  .logo .phone { text-align: right; font-size: 8.5pt; margin-top: 4px; }
  .title { text-align: center; font-weight: bold; font-size: 13pt; padding: 8px 0; border-bottom: 0.8pt solid #000; }
  .bar { display: flex; justify-content: space-between; font-weight: bold; padding: 8px 14px; border-bottom: 0.8pt solid #000; }
  .consignee { padding: 9px 14px 12px; border-bottom: 0.8pt solid #000; line-height: 1.45; }
  .consignee .label { font-weight: bold; font-size: 9pt; margin-bottom: 4px; }
  .bundles { padding: 9px 14px; border-bottom: 0.8pt solid #000; }
  table { width: 100%; border-collapse: collapse; }
  th { font-weight: bold; font-size: 9pt; padding: 8px 6px; border-bottom: 0.8pt solid #000; text-align: center; }
  td { padding: 6px 8px; vertical-align: top; }
  th + th, td + td { border-left: 0.8pt solid #000; }
  .c { text-align: center; }
  .total td { border-top: 0.8pt solid #000; font-weight: bold; padding: 12px 8px; }
  .total td + td { border-left: none; }
  .sign { display: flex; justify-content: space-between; font-weight: bold; font-size: 9pt; margin-top: 30mm; padding: 0 2px; }
`;

const dmy = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** One delivery note page: booking, date, consignee, bundle count, then each product line with its bundle as the remark. */
function deliveryNoteSheetHtml(p: DeliveryNoteData): string {
  const totalQty = p.rows.reduce((n, r) => n + (Number(r.qty) || 0), 0);
  const bundles = new Set(p.rows.map((r) => r.bundleNo).filter(Boolean)).size;
  const consignee = [`<b>${esc(p.receiver.name)}</b>`, ...p.receiver.lines.filter(Boolean).map((l) => esc(l.replace(/^Ph:\s*/, "")))].join("<br/>");
  const rows = p.rows
    .map(
      (r, i) =>
        `<tr><td class="c">${i + 1}</td><td>${esc(r.product)}${r.qty ? ` – ${esc(r.qty)} pcs` : ""}</td><td class="c">${r.bundleNo ? `Bundle ${esc(r.bundleNo)}` : ""}</td></tr>`
    )
    .join("");
  // Keep the item area as tall as the printed form.
  const filler = Math.max(40, 360 - p.rows.length * 28);
  return `<section class="sheet">
  <div class="box">
    <div class="logo"><img src="${LOGO_DATA_URI}" alt="Introlines Merchant Exports"/><div class="phone">00971 56 504 9779</div></div>
    <div class="title">DELIVERY NOTE</div>
    <div class="bar"><span>BOOKING ID: ${esc(p.lrNo)}</span><span>DATE:${dmy(new Date())}</span></div>
    <div class="consignee"><div class="label">CONSIGNEE DETAILS</div>${consignee}</div>
    <div class="bundles">No of Bundles${bundles ? `: <b>${bundles}</b>` : ""}</div>
    <table>
      <thead><tr><th style="width:10%">SI NO</th><th>DESCRIPTION</th><th style="width:18%">REMARKS</th></tr></thead>
      <tbody>${rows}<tr><td style="height:${filler}px"></td><td></td><td></td></tr></tbody>
      <tfoot><tr class="total"><td></td><td>TOTAL${totalQty ? ` &nbsp; ${totalQty} pcs` : ""}</td><td></td></tr></tfoot>
    </table>
  </div>
  <div class="sign"><span style="margin-top:6px">RECEIVERS SIGN</span><span style="margin-right:30px">SIGNATURE</span></div>
</section>`;
}

/** A single booking's delivery note, saved as `filename`. */
export const downloadDeliveryNoteFormPdf = (filename: string, note: DeliveryNoteData) =>
  downloadSheetsPdf(filename, DELIVERY_NOTE_STYLE, [deliveryNoteSheetHtml(note)], 14);
