/**
 * Invoice PDF generator — reproduces the Digital Support Systems invoice layout
 * (letterhead, To / Ship To blocks, meta strip, line-item table, Total Due,
 * "make checks payable" footer). Single fixed template.
 *
 * Requires: pdfkit (already a project dependency, used by generate-proposal-pdf.ts)
 */
import PDFDocument from 'pdfkit';
import type { InvoiceParty, InvoiceRow } from '@/lib/invoice';

export interface InvoiceCompanyInfo {
  companyName?:    string | null;
  companyTagline?: string | null;
  companyAddress?: string | null;
  companyPhone?:   string | null;
  companyFax?:     string | null;
  companyWebsite?: string | null;
  logoUrl?:        string | null;
  payableTo?:      string | null;   // "Digital Support Systems, Inc. / j6Corp, ltd (EIN# ...)"
  contactName?:    string | null;   // footer contact (e.g. "Jim Wilson")
  contactPhone?:   string | null;
  contactEmail?:   string | null;
}

export interface InvoiceDocData {
  invoiceNumber:     string;
  documentCode?:     string | null;   // e.g. "COG-2220-0211-011"
  date:              string;          // pre-formatted
  poNumber?:         string | null;
  salesperson?:      string | null;
  terms?:            string | null;
  shippedVia?:       string | null;
  fobPoint?:         string | null;
  billTo:            InvoiceParty;
  shipTo?:           InvoiceParty | null;
  rows:              InvoiceRow[];
  subtotal:          number;
  shippingHandling?: number | null;
  totalDue:          number;
  basisCaption:      string;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

const NAVY  = '#1E3A5F';
const GREY  = '#6B7280';
const LIGHT = '#F3F4F6';
const LINE  = '#D1D5DB';

export async function generateInvoicePdf(
  data:    InvoiceDocData,
  company: InvoiceCompanyInfo = {},
): Promise<Buffer> {
  const doc    = new PDFDocument({ margin: 50, size: 'LETTER' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finish = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const margin = 50;
  const pageW  = 612;
  const right  = pageW - margin;   // 562
  const inner  = pageW - margin * 2;

  // ── Logo (optional) ──────────────────────────────────────────────────────
  let logoBuffer: Buffer | null = null;
  if (company.logoUrl) {
    try {
      const res = await fetch(company.logoUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer());
    } catch { /* ignore */ }
  }

  // ── Header: company block (left) ─────────────────────────────────────────
  let headerY = margin;
  if (logoBuffer) {
    try { doc.image(logoBuffer, margin, headerY, { fit: [120, 48] }); } catch { /* ignore */ }
  }
  const companyTextX = logoBuffer ? margin + 132 : margin;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(15)
     .text(company.companyName ?? 'Company Name', companyTextX, headerY, { width: 300 });
  if (company.companyTagline) {
    doc.fillColor(GREY).font('Helvetica-Oblique').fontSize(8)
       .text(company.companyTagline, companyTextX, doc.y, { width: 300 });
  }
  doc.fillColor('#111827').font('Helvetica').fontSize(8.5);
  if (company.companyAddress) doc.text(company.companyAddress, companyTextX, doc.y + 2, { width: 300 });
  const contactLine = [
    company.companyPhone ? `Tel: ${company.companyPhone}` : null,
    company.companyFax   ? `Fax: ${company.companyFax}`   : null,
  ].filter(Boolean).join('   ');
  if (contactLine) doc.text(contactLine, companyTextX, doc.y, { width: 300 });

  // ── Header: INVOICE block (right) ────────────────────────────────────────
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(22)
     .text('INVOICE', right - 200, margin, { width: 200, align: 'right' });
  doc.fillColor('#111827').font('Helvetica').fontSize(9);
  doc.text(`DATE: ${data.date}`, right - 200, margin + 30, { width: 200, align: 'right' });
  if (data.documentCode) {
    doc.fillColor(GREY).text(data.documentCode, right - 200, doc.y + 2, { width: 200, align: 'right' });
  }

  // ── To / Ship To blocks ──────────────────────────────────────────────────
  let y = Math.max(doc.y, headerY + 70) + 24;
  const colW = (inner - 20) / 2;
  const shipX = margin + colW + 20;

  function party(label: string, x: number, p: InvoiceParty | null | undefined) {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8.5).text(label, x, y, { width: colW });
    doc.fillColor('#111827').font('Helvetica').fontSize(9.5);
    const lines = [p?.name, p?.address].filter(Boolean).join('\n');
    doc.text(lines || '—', x, y + 13, { width: colW });
  }
  party('TO:', margin, data.billTo);
  party('SHIP TO:', shipX, data.shipTo ?? data.billTo);
  y = doc.y + 18;

  // ── Meta strip ───────────────────────────────────────────────────────────
  const metaCols = [
    { label: 'SALESPERSON', value: data.salesperson ?? '' },
    { label: 'P.O. NUMBER', value: data.poNumber ?? '' },
    { label: 'INVOICE NO#', value: data.invoiceNumber },
    { label: 'SHIPPED VIA', value: data.shippedVia ?? '' },
    { label: 'F.O.B. POINT', value: data.fobPoint ?? '' },
    { label: 'TERMS', value: data.terms ?? '' },
  ];
  const mW = inner / metaCols.length;
  doc.rect(margin, y, inner, 16).fill(NAVY);
  doc.rect(margin, y + 16, inner, 18).fillAndStroke(LIGHT, LINE);
  metaCols.forEach((c, i) => {
    const cx = margin + i * mW;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(6.5)
       .text(c.label, cx + 3, y + 5, { width: mW - 6, align: 'center' });
    doc.fillColor('#111827').font('Helvetica').fontSize(8)
       .text(c.value, cx + 3, y + 21, { width: mW - 6, align: 'center' });
    if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + 34).strokeColor(LINE).stroke();
  });
  y += 34 + 16;

  // ── Line-item table ──────────────────────────────────────────────────────
  // Columns: QUANTITY | DESCRIPTION | UNIT PRICE | AMOUNT
  const cQty  = 60;
  const cUnit = 80;
  const cAmt  = 80;
  const cDesc = inner - cQty - cUnit - cAmt;
  const xQty  = margin;
  const xDesc = xQty + cQty;
  const xUnit = xDesc + cDesc;
  const xAmt  = xUnit + cUnit;

  function tableHeader(atY: number): number {
    doc.rect(margin, atY, inner, 18).fill(NAVY);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    doc.text('QUANTITY',    xQty + 4,  atY + 5, { width: cQty - 8 });
    doc.text('DESCRIPTION', xDesc + 4, atY + 5, { width: cDesc - 8 });
    doc.text('UNIT PRICE',  xUnit,     atY + 5, { width: cUnit - 4, align: 'right' });
    doc.text('AMOUNT',      xAmt,      atY + 5, { width: cAmt - 4,  align: 'right' });
    return atY + 18;
  }

  y = tableHeader(y);

  doc.font('Helvetica').fontSize(9);
  data.rows.forEach((row, i) => {
    const descHeight = doc.heightOfString(row.description, { width: cDesc - 8 });
    const rowH = Math.max(18, descHeight + 8);

    // page break
    if (y + rowH > doc.page.height - 120) {
      doc.addPage();
      y = margin;
      y = tableHeader(y);
      doc.font('Helvetica').fontSize(9);
    }

    if (i % 2 === 1) doc.rect(margin, y, inner, rowH).fill(LIGHT);
    doc.fillColor('#111827').font('Helvetica').fontSize(9);
    doc.text(row.quantity, xQty + 4, y + 4, { width: cQty - 8 });
    doc.text(row.description, xDesc + 4, y + 4, { width: cDesc - 8 });
    doc.text(row.unitPrice == null ? '' : fmt(row.unitPrice), xUnit, y + 4, { width: cUnit - 4, align: 'right' });
    doc.text(fmt(row.amount), xAmt, y + 4, { width: cAmt - 4, align: 'right' });
    y += rowH;
  });

  // table outer border
  doc.rect(margin, y, 0, 0); // noop to keep state
  doc.moveTo(margin, y).lineTo(right, y).strokeColor(LINE).stroke();

  // ── Totals block (right-aligned) ─────────────────────────────────────────
  y += 10;
  const totLabelX = xUnit - 60;
  const totW      = cUnit + 60;
  function totalRow(label: string, value: number, bold = false) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9)
       .fillColor('#111827');
    doc.text(label, totLabelX, y, { width: totW, align: 'left' });
    doc.text(fmt(value), xAmt, y, { width: cAmt - 4, align: 'right' });
    y += bold ? 18 : 15;
  }
  totalRow('Subtotal', data.subtotal);
  totalRow('Shipping & Handling', data.shippingHandling ?? 0);
  doc.moveTo(totLabelX, y).lineTo(right, y).strokeColor(LINE).stroke();
  y += 4;
  totalRow('TOTAL DUE', data.totalDue, true);
  doc.fillColor(GREY).font('Helvetica-Oblique').fontSize(7.5)
     .text(data.basisCaption, totLabelX, y, { width: totW + cAmt, align: 'right' });
  y += 24;

  // ── Footer ───────────────────────────────────────────────────────────────
  const footerY = Math.max(y, doc.page.height - 90);
  doc.moveTo(margin, footerY).lineTo(right, footerY).strokeColor(LINE).stroke();
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8.5)
     .text(`Make checks payable to: ${company.payableTo ?? company.companyName ?? ''}`, margin, footerY + 8, { width: inner });
  const contactBits = [
    company.contactName ? `call: ${company.contactName}` : null,
    company.contactPhone,
    company.contactEmail ? `email: ${company.contactEmail}` : null,
  ].filter(Boolean).join(', ');
  if (contactBits) {
    doc.fillColor(GREY).font('Helvetica').fontSize(8)
       .text(`If you have any questions concerning this invoice, ${contactBits}`, margin, doc.y + 2, { width: inner });
  }

  doc.end();
  return finish;
}
