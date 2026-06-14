/**
 * Invoice Word (.docx) generator — Digital Support Systems invoice layout.
 * Single fixed template. Shares InvoiceDocData / InvoiceCompanyInfo types with
 * the PDF generator.
 *
 * Requires: docx (already a project dependency)
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, ImageRun, VerticalAlign,
} from 'docx';
import type { InvoiceDocData, InvoiceCompanyInfo } from '@/lib/generate-invoice-pdf';

const PAGE_W    = 12240;   // 8.5in DXA
const MARGIN    = 1080;    // 0.75in
const CONTENT_W = PAGE_W - MARGIN * 2;   // 10080

const NAVY  = '1E3A5F';
const GREY  = '6B7280';
const LIGHT = 'F3F4F6';
const NOBORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

async function fetchLogoBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}
function guessImageType(url: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'gif') return 'gif';
  if (ext === 'bmp') return 'bmp';
  return 'png';
}

function shade(fill: string) {
  return { type: ShadingType.CLEAR, color: 'auto', fill };
}
function noBorders() {
  return { top: NOBORDER, bottom: NOBORDER, left: NOBORDER, right: NOBORDER };
}

export async function generateInvoiceDocx(
  data:    InvoiceDocData,
  company: InvoiceCompanyInfo = {},
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // ── Logo ───────────────────────────────────────────────────────────────
  let logoBuffer: Buffer | null = null;
  let logoType: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
  if (company.logoUrl) {
    logoBuffer = await fetchLogoBuffer(company.logoUrl);
    logoType   = guessImageType(company.logoUrl);
  }

  // ── Header: company (left) vs INVOICE (right) in a borderless 2-col table ──
  const companyCellChildren: Paragraph[] = [];
  if (logoBuffer) {
    companyCellChildren.push(new Paragraph({
      children: [new ImageRun({
        type: logoType, data: logoBuffer,
        transformation: { width: 130, height: 48 },
        altText: { title: 'logo', description: 'logo', name: 'logo' },
      })],
    }));
  }
  companyCellChildren.push(new Paragraph({
    children: [new TextRun({ text: company.companyName ?? 'Company Name', bold: true, size: 28, color: NAVY })],
  }));
  if (company.companyTagline) {
    companyCellChildren.push(new Paragraph({
      children: [new TextRun({ text: company.companyTagline, italics: true, size: 15, color: GREY })],
    }));
  }
  if (company.companyAddress) {
    for (const line of company.companyAddress.split('\n')) {
      companyCellChildren.push(new Paragraph({ children: [new TextRun({ text: line, size: 17 })] }));
    }
  }
  const telFax = [
    company.companyPhone ? `Tel: ${company.companyPhone}` : null,
    company.companyFax   ? `Fax: ${company.companyFax}`   : null,
  ].filter(Boolean).join('   ');
  if (telFax) companyCellChildren.push(new Paragraph({ children: [new TextRun({ text: telFax, size: 17 })] }));

  const invoiceCellChildren: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'INVOICE', bold: true, size: 44, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `DATE: ${data.date}`, size: 18 })] }),
  ];
  if (data.documentCode) {
    invoiceCellChildren.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: data.documentCode, size: 16, color: GREY })] }));
  }

  children.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: noBorders(),
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: CONTENT_W * 0.6, type: WidthType.DXA }, borders: noBorders(), children: companyCellChildren }),
      new TableCell({ width: { size: CONTENT_W * 0.4, type: WidthType.DXA }, borders: noBorders(), children: invoiceCellChildren }),
    ] })],
  }));

  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // ── To / Ship To ──────────────────────────────────────────────────────────
  function partyCell(label: string, p: { name?: string | null; address?: string | null } | null | undefined) {
    const kids: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 17, color: NAVY })] }),
    ];
    const text = [p?.name, p?.address].filter(Boolean).join('\n') || '—';
    for (const line of text.split('\n')) {
      kids.push(new Paragraph({ children: [new TextRun({ text: line, size: 19 })] }));
    }
    return new TableCell({ width: { size: CONTENT_W / 2, type: WidthType.DXA }, borders: noBorders(), children: kids });
  }
  children.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: noBorders(),
    rows: [new TableRow({ children: [
      partyCell('TO:', data.billTo),
      partyCell('SHIP TO:', data.shipTo ?? data.billTo),
    ] })],
  }));

  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // ── Meta strip ──────────────────────────────────────────────────────────
  const meta = [
    ['SALESPERSON', data.salesperson ?? ''],
    ['P.O. NUMBER', data.poNumber ?? ''],
    ['INVOICE NO#', data.invoiceNumber],
    ['SHIPPED VIA', data.shippedVia ?? ''],
    ['F.O.B. POINT', data.fobPoint ?? ''],
    ['TERMS', data.terms ?? ''],
  ];
  const metaCellW = CONTENT_W / meta.length;
  children.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [
      new TableRow({ children: meta.map(([label]) => new TableCell({
        width: { size: metaCellW, type: WidthType.DXA }, shading: shade(NAVY),
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: label, bold: true, size: 12, color: 'FFFFFF' })] })],
      })) }),
      new TableRow({ children: meta.map(([, value]) => new TableCell({
        width: { size: metaCellW, type: WidthType.DXA }, shading: shade(LIGHT),
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: value, size: 16 })] })],
      })) }),
    ],
  }));

  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // ── Line-item table ─────────────────────────────────────────────────────
  const W_QTY = 1200, W_UNIT = 1700, W_AMT = 1700;
  const W_DESC = CONTENT_W - W_QTY - W_UNIT - W_AMT;

  function headCell(text: string, w: number, align: typeof AlignmentType[keyof typeof AlignmentType]) {
    return new TableCell({
      width: { size: w, type: WidthType.DXA }, shading: shade(NAVY),
      children: [new Paragraph({ alignment: align, children: [new TextRun({ text, bold: true, size: 16, color: 'FFFFFF' })] })],
    });
  }
  const headerRow = new TableRow({ tableHeader: true, children: [
    headCell('QUANTITY', W_QTY, AlignmentType.LEFT),
    headCell('DESCRIPTION', W_DESC, AlignmentType.LEFT),
    headCell('UNIT PRICE', W_UNIT, AlignmentType.RIGHT),
    headCell('AMOUNT', W_AMT, AlignmentType.RIGHT),
  ] });

  const bodyRows = data.rows.map((row, i) => {
    const fill = i % 2 === 1 ? LIGHT : 'FFFFFF';
    const cell = (text: string, w: number, align: typeof AlignmentType[keyof typeof AlignmentType]) => new TableCell({
      width: { size: w, type: WidthType.DXA }, shading: shade(fill), verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: align, children: [new TextRun({ text, size: 18 })] })],
    });
    return new TableRow({ children: [
      cell(row.quantity, W_QTY, AlignmentType.LEFT),
      cell(row.description, W_DESC, AlignmentType.LEFT),
      cell(row.unitPrice == null ? '' : fmt(row.unitPrice), W_UNIT, AlignmentType.RIGHT),
      cell(fmt(row.amount), W_AMT, AlignmentType.RIGHT),
    ] });
  });

  children.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
  }));

  // ── Totals block ──────────────────────────────────────────────────────────
  function totalsRow(label: string, value: number, bold = false) {
    return new TableRow({ children: [
      new TableCell({ width: { size: W_QTY + W_DESC, type: WidthType.DXA }, borders: noBorders(), children: [new Paragraph({ children: [] })] }),
      new TableCell({ width: { size: W_UNIT, type: WidthType.DXA }, borders: noBorders(),
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: label, bold, size: bold ? 22 : 18 })] })] }),
      new TableCell({ width: { size: W_AMT, type: WidthType.DXA }, borders: noBorders(),
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(value), bold, size: bold ? 22 : 18 })] })] }),
    ] });
  }
  children.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: noBorders(),
    rows: [
      totalsRow('Subtotal', data.subtotal),
      totalsRow('Shipping & Handling', data.shippingHandling ?? 0),
      totalsRow('TOTAL DUE', data.totalDue, true),
    ],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: data.basisCaption, italics: true, size: 15, color: GREY })],
  }));

  // ── Footer ──────────────────────────────────────────────────────────────
  children.push(new Paragraph({ spacing: { before: 360 }, children: [
    new TextRun({ text: `Make checks payable to: ${company.payableTo ?? company.companyName ?? ''}`, bold: true, size: 17 }),
  ] }));
  const contactBits = [
    company.contactName ? `call: ${company.contactName}` : null,
    company.contactPhone,
    company.contactEmail ? `email: ${company.contactEmail}` : null,
  ].filter(Boolean).join(', ');
  if (contactBits) {
    children.push(new Paragraph({ children: [
      new TextRun({ text: `If you have any questions concerning this invoice, ${contactBits}`, size: 16, color: GREY }),
    ] }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      children,
    }],
  });

  return Packer.toBuffer(doc) as unknown as Buffer;
}
