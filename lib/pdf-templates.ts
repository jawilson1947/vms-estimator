/**
 * Five PDF design templates for proposal generation.
 *
 * Each template defines:
 *  - cover()         — full cover-page layout
 *  - pageHeader()    — running header drawn on every content page
 *  - pageFooter()    — running footer drawn on every content page
 *  - sectionHeading() — section title bar / label style
 *  - tc              — colour palette used by the shared cost table
 *
 * The template is selected by the `template` field stored on the Proposal row.
 */
import PDFDocument from 'pdfkit';

type Doc = InstanceType<typeof PDFDocument>;

// ── Option shapes ─────────────────────────────────────────────────────────────

export interface CoverOpts {
  pageW: number;
  pageH: number;
  margin: number;
  inner: number;
  projectName: string;
  projectNumber?: string | null;
  projectManager?: string | null;
  customerName: string;
  date: string;
  validUntil: string;
  grandTotal?: string;
  // Company branding
  companyName?:    string | null;
  companyTagline?: string | null;
  companyAddress?: string | null;
  companyPhone?:   string | null;
  companyWebsite?: string | null;
  projectSummary?: string | null;
  siteName?:       string | null;
  logoBuffer?:     Buffer;
}

export interface HeaderOpts {
  pageW: number;
  margin: number;
  date: string;
}

export interface FooterOpts {
  pageW: number;
  margin: number;
  projectName: string;
  pageNum: number;
}

export interface HeadingOpts {
  margin: number;
  inner: number;
  label: string;
}

export interface TableColors {
  tableHdr:     string;
  tableHdrText: string;
  tableAlt:     string;
  catRow:       string;
  catRowText:   string;
  subRow:       string;
  subRowText:   string;
  totalBar:     string;
  totalText:    string;
  bodyText:     string;
  dimText:      string;
}

export interface PdfTemplate {
  id:          string;
  name:        string;
  description: string;
  tc:          TableColors;
  cover(doc: Doc, opts: CoverOpts): void;
  pageHeader(doc: Doc, opts: HeaderOpts): void;
  pageFooter(doc: Doc, opts: FooterOpts): void;
  sectionHeading(doc: Doc, opts: HeadingOpts): void;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function hRule(doc: Doc, x1: number, y: number, x2: number, color = '#E5E7EB', w = 0.5) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(w).stroke();
}

function coverDetail(
  doc: Doc,
  labelX: number, valueX: number, valueW: number,
  y: number,
  label: string, value: string,
  labelColor: string, valueColor: string,
) {
  doc.fillColor(labelColor).fontSize(7.5).font('Helvetica-Bold')
     .text(label.toUpperCase(), labelX, y);
  doc.fillColor(valueColor).fontSize(9).font('Helvetica')
     .text(value, valueX, y, { width: valueW });
}

// ── Shared centered cover layout (used by all five templates) ─────────────────
//
// Structure (matches reference document):
//   Company name / tagline / address / phone+web   (centered, top)
//   ── rule ──
//   "PROPOSAL"  (section label, primary color)
//   Customer · Project name · Project number
//   ── rule ──
//   "PREPARED FOR"  (section label)
//   Customer name
//   "PROJECT SUMMARY"  (section label)
//   Summary text
//   ── rule ──
//   "DATE"  (section label)
//   Date · Valid until
//   ── rule ──  [if grandTotal]
//   "INVESTMENT TOTAL"  (section label)
//   Grand total
//   ── rule ──  (near bottom)
//   "CONFIDENTIALITY STATEMENT"  (section label)
//   Boilerplate text

interface CoverColors {
  primary: string;  // section labels + grand total
  body:    string;  // customer / project / PM names
  dim:     string;  // address, date, sub-labels
}

function drawCenteredCover(doc: Doc, opts: CoverOpts, c: CoverColors) {
  const { pageW, pageH, margin, inner } = opts;

  // White background
  doc.rect(0, 0, pageW, pageH).fill('#FFFFFF');

  const x = margin;
  let y   = 52;

  // ── Company block ────────────────────────────────────────────────────────
  if (opts.logoBuffer) {
    try {
      // Scale to fit within 160×60 while preserving aspect ratio
      doc.image(opts.logoBuffer, x, y, { width: 160, align: 'center', valign: 'center', fit: [160, 60] });
      y += 68;
    } catch { /* skip bad image */ }
  }

  const cName = opts.companyName ?? 'CSMS';
  doc.fillColor(c.primary).fontSize(13).font('Helvetica-Bold')
     .text(cName, x, y, { width: inner, align: 'center' });
  y += 18;

  if (opts.companyTagline) {
    doc.fillColor(c.dim).fontSize(9).font('Helvetica')
       .text(opts.companyTagline, x, y, { width: inner, align: 'center' });
    y += 14;
  }

  if (opts.companyAddress) {
    const lines = opts.companyAddress.split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, 3);
    for (const line of lines) {
      doc.fillColor(c.dim).fontSize(8.5).font('Helvetica')
         .text(line, x, y, { width: inner, align: 'center' });
      y += 12;
    }
  }

  const phoneWeb = [opts.companyPhone, opts.companyWebsite].filter(Boolean).join('  |  ');
  if (phoneWeb) {
    doc.fillColor(c.dim).fontSize(8.5).font('Helvetica')
       .text(phoneWeb, x, y, { width: inner, align: 'center' });
    y += 12;
  }

  y += 14;
  hRule(doc, margin + 60, y, pageW - margin - 60, '#D1D5DB', 0.5);
  y += 20;

  // ── Proposal section ─────────────────────────────────────────────────────
  doc.fillColor(c.primary).fontSize(8).font('Helvetica-Bold')
     .text('PROPOSAL', x, y, { width: inner, align: 'center' });
  y += 16;

  doc.fillColor(c.body).fontSize(18).font('Helvetica-Bold')
     .text(opts.customerName, x, y, { width: inner, align: 'center' });
  y += 26;

  if (opts.siteName) {
    doc.fillColor(c.dim).fontSize(11).font('Helvetica')
       .text(opts.siteName, x, y, { width: inner, align: 'center' });
    y += 16;
  }

  doc.fillColor(c.body).fontSize(12).font('Helvetica-Bold')
     .text(opts.projectName, x, y, { width: inner, align: 'center' });
  y += 18;

  if (opts.projectNumber) {
    doc.fillColor(c.dim).fontSize(9).font('Helvetica')
       .text(`Project No. ${opts.projectNumber}`, x, y, { width: inner, align: 'center' });
    y += 14;
  }

  y += 10;
  hRule(doc, margin + 60, y, pageW - margin - 60, '#D1D5DB', 0.5);
  y += 20;

  // ── Prepared for ─────────────────────────────────────────────────────────
  doc.fillColor(c.primary).fontSize(8).font('Helvetica-Bold')
     .text('PREPARED FOR', x, y, { width: inner, align: 'center' });
  y += 16;

  doc.fillColor(c.body).fontSize(12).font('Helvetica-Bold')
     .text(opts.projectManager ?? '—', x, y, { width: inner, align: 'center' });
  y += 18;

  y += 10;
  hRule(doc, margin + 60, y, pageW - margin - 60, '#D1D5DB', 0.5);
  y += 20;

  // ── Project summary ───────────────────────────────────────────────────────
  if (opts.projectSummary) {
    doc.fillColor(c.primary).fontSize(8).font('Helvetica-Bold')
       .text('PROJECT SUMMARY', x, y, { width: inner, align: 'center' });
    y += 16;

    doc.fillColor(c.dim).fontSize(9).font('Helvetica')
       .text(opts.projectSummary, x, y, { width: inner, align: 'center', lineGap: 2 });
    y += doc.heightOfString(opts.projectSummary, { width: inner }) + 8;

    y += 10;
    hRule(doc, margin + 60, y, pageW - margin - 60, '#D1D5DB', 0.5);
    y += 20;
  }

  // ── Date ─────────────────────────────────────────────────────────────────
  doc.fillColor(c.primary).fontSize(8).font('Helvetica-Bold')
     .text('DATE', x, y, { width: inner, align: 'center' });
  y += 16;

  doc.fillColor(c.body).fontSize(10).font('Helvetica')
     .text(opts.date, x, y, { width: inner, align: 'center' });
  y += 14;

  doc.fillColor(c.dim).fontSize(9).font('Helvetica')
     .text(`Valid Until: ${opts.validUntil}`, x, y, { width: inner, align: 'center' });
  y += 14;

  // ── Investment total ──────────────────────────────────────────────────────
  if (opts.grandTotal) {
    y += 6;
    hRule(doc, margin + 60, y, pageW - margin - 60, '#D1D5DB', 0.5);
    y += 20;

    doc.fillColor(c.primary).fontSize(8).font('Helvetica-Bold')
       .text('INVESTMENT TOTAL', x, y, { width: inner, align: 'center' });
    y += 16;

    doc.fillColor(c.primary).fontSize(24).font('Helvetica-Bold')
       .text(opts.grandTotal, x, y, { width: inner, align: 'center' });
  }

  // ── Confidentiality statement ─────────────────────────────────────────────
  const confText = 'This proposal contains confidential and proprietary information intended solely for the use of the named recipient. No part of this document may be reproduced, distributed, or disclosed without the written consent of the principal investigator.';
  const confY = pageH - 100;
  hRule(doc, margin, confY - 10, pageW - margin, '#D1D5DB', 0.5);
  doc.fillColor(c.primary).fontSize(8).font('Helvetica-Bold')
     .text('CONFIDENTIALITY STATEMENT', x, confY, { width: inner, align: 'center' });
  doc.fillColor(c.dim).fontSize(8).font('Helvetica')
     .text(confText, x, confY + 14, { width: inner, align: 'center', lineGap: 2 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLASSIC — Bold navy, the original house style
// ─────────────────────────────────────────────────────────────────────────────
const classic: PdfTemplate = {
  id: 'classic', name: 'Classic', description: 'Bold navy cover with structured grey section bars',
  tc: {
    tableHdr: '#1E3A5F', tableHdrText: '#FFFFFF',
    tableAlt: '#F9FAFB',
    catRow: '#F3F4F6', catRowText: '#1E3A5F',
    subRow: '#EEF2FF', subRowText: '#1E3A5F',
    totalBar: '#2563EB', totalText: '#FFFFFF',
    bodyText: '#111827', dimText: '#6B7280',
  },

  cover(doc, opts) {
    drawCenteredCover(doc, opts, { primary: '#1E3A5F', body: '#111827', dim: '#6B7280' });
  },

  pageHeader(doc, { pageW, margin, date }) {
    doc.rect(0, 0, pageW, 72).fill('#1E3A5F');
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text('CSMS', margin, 20);
    doc.fillColor('#93C5FD').fontSize(9).font('Helvetica')
       .text('Camera & Security Management Systems', margin, 40);
    doc.fillColor('#CBD5E1').fontSize(9)
       .text(date, pageW - margin - 120, 40, { width: 120, align: 'right' });
  },

  pageFooter(doc, { pageW, margin, projectName, pageNum }) {
    const y = doc.page.height - 36;
    hRule(doc, margin, y, pageW - margin);
    doc.fillColor('#6B7280').fontSize(8).font('Helvetica')
       .text(`${projectName} — Confidential`, margin, y + 8)
       .text(`Page ${pageNum}`, margin, y + 8, { width: pageW - margin * 2, align: 'right' });
  },

  sectionHeading(doc, { margin, inner, label }) {
    const y = doc.y;
    doc.rect(margin, y, inner, 24).fill('#F3F4F6');
    doc.fillColor('#1E3A5F').fontSize(11).font('Helvetica-Bold')
       .text(label, margin + 8, y + 7, { width: inner - 16 });
    doc.y = y + 30;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXECUTIVE — Slate charcoal, corporate precision
// ─────────────────────────────────────────────────────────────────────────────
const executive: PdfTemplate = {
  id: 'executive', name: 'Executive', description: 'Slate charcoal cover with left-bar section accents',
  tc: {
    tableHdr: '#1E293B', tableHdrText: '#FFFFFF',
    tableAlt: '#F8FAFC',
    catRow: '#E2E8F0', catRowText: '#0F172A',
    subRow: '#F1F5F9', subRowText: '#0F172A',
    totalBar: '#334155', totalText: '#FFFFFF',
    bodyText: '#0F172A', dimText: '#64748B',
  },

  cover(doc, opts) {
    drawCenteredCover(doc, opts, { primary: '#0F172A', body: '#0F172A', dim: '#64748B' });
  },

  pageHeader(doc, { pageW, margin, date }) {
    doc.rect(0, 0, pageW, 50).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(13).font('Helvetica-Bold').text('CSMS', margin, 18);
    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
       .text(date, pageW - margin - 120, 20, { width: 120, align: 'right' });
  },

  pageFooter(doc, { pageW, margin, projectName, pageNum }) {
    const y = doc.page.height - 36;
    hRule(doc, margin, y, pageW - margin, '#CBD5E1');
    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
       .text(`${projectName} — Confidential`, margin, y + 8)
       .text(`${pageNum}`, margin, y + 8, { width: pageW - margin * 2, align: 'right' });
  },

  sectionHeading(doc, { margin, inner, label }) {
    const y = doc.y;
    // 4 px left accent bar + text beside it
    doc.rect(margin, y, 4, 22).fill('#1E293B');
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold')
       .text(label, margin + 12, y + 5, { width: inner - 12 });
    doc.y = y + 30;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. MODERN — Teal, clean and contemporary
// ─────────────────────────────────────────────────────────────────────────────
const modern: PdfTemplate = {
  id: 'modern', name: 'Modern', description: 'Teal accent cover with pill-style section headings',
  tc: {
    tableHdr: '#0F766E', tableHdrText: '#FFFFFF',
    tableAlt: '#F0FDFA',
    catRow: '#CCFBF1', catRowText: '#134E4A',
    subRow: '#F0FDFA', subRowText: '#134E4A',
    totalBar: '#0D9488', totalText: '#FFFFFF',
    bodyText: '#111827', dimText: '#6B7280',
  },

  cover(doc, opts) {
    drawCenteredCover(doc, opts, { primary: '#0F766E', body: '#111827', dim: '#6B7280' });
  },

  pageHeader(doc, { pageW, margin, date }) {
    doc.rect(0, 0, pageW, 55).fill('#0F766E');
    doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('CSMS', margin, 18);
    doc.fillColor('#99F6E4').fontSize(8).font('Helvetica')
       .text(date, pageW - margin - 120, 22, { width: 120, align: 'right' });
  },

  pageFooter(doc, { pageW, margin, projectName, pageNum }) {
    const y = doc.page.height - 36;
    doc.rect(0, y - 2, pageW, 2).fill('#CCFBF1');
    doc.fillColor('#6B7280').fontSize(8).font('Helvetica')
       .text(`${projectName} — Confidential`, margin, y + 6)
       .text(`Page ${pageNum}`, margin, y + 6, { width: pageW - margin * 2, align: 'right' });
  },

  sectionHeading(doc, { margin, inner, label }) {
    const y = doc.y;
    // Pill: teal rectangle (rounded via clipping isn't easy in pdfkit, use rect)
    doc.rect(margin, y, inner, 22).fill('#F0FDFA');
    doc.rect(margin, y, 3, 22).fill('#0F766E');
    doc.fillColor('#0F766E').fontSize(11).font('Helvetica-Bold')
       .text(label, margin + 10, y + 5, { width: inner - 14 });
    doc.y = y + 28;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. BOLD — Deep purple, high impact
// ─────────────────────────────────────────────────────────────────────────────
const bold: PdfTemplate = {
  id: 'bold', name: 'Bold', description: 'Full-bleed purple cover with strong geometric accents',
  tc: {
    tableHdr: '#4C1D95', tableHdrText: '#FFFFFF',
    tableAlt: '#FAF5FF',
    catRow: '#EDE9FE', catRowText: '#2E1065',
    subRow: '#F5F3FF', subRowText: '#2E1065',
    totalBar: '#7C3AED', totalText: '#FFFFFF',
    bodyText: '#111827', dimText: '#6B7280',
  },

  cover(doc, opts) {
    drawCenteredCover(doc, opts, { primary: '#6D28D9', body: '#111827', dim: '#6B7280' });
  },

  pageHeader(doc, { pageW, margin, date }) {
    doc.rect(0, 0, pageW, 65).fill('#4C1D95');
    doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold').text('CSMS', margin, 20);
    doc.fillColor('#C4B5FD').fontSize(8).font('Helvetica')
       .text('Camera & Security Management Systems', margin, 39);
    doc.fillColor('#DDD6FE').fontSize(8)
       .text(date, pageW - margin - 120, 27, { width: 120, align: 'right' });
  },

  pageFooter(doc, { pageW, margin, projectName, pageNum }) {
    const y = doc.page.height - 36;
    hRule(doc, margin, y, pageW - margin, '#DDD6FE');
    doc.fillColor('#6B7280').fontSize(8).font('Helvetica')
       .text(`${projectName} — Confidential`, margin, y + 8)
       .text(`Page ${pageNum}`, margin, y + 8, { width: pageW - margin * 2, align: 'right' });
  },

  sectionHeading(doc, { margin, inner, label }) {
    const y = doc.y;
    doc.rect(margin, y, inner, 26).fill('#4C1D95');
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
       .text(label, margin + 10, y + 8, { width: inner - 20 });
    doc.y = y + 32;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. MINIMAL — Monochrome, pure typography
// ─────────────────────────────────────────────────────────────────────────────
const minimal: PdfTemplate = {
  id: 'minimal', name: 'Minimal', description: 'Clean white cover with typographic hierarchy, no colour fills',
  tc: {
    tableHdr: '#111827', tableHdrText: '#FFFFFF',
    tableAlt: '#F9FAFB',
    catRow: '#F3F4F6', catRowText: '#111827',
    subRow: '#F9FAFB', subRowText: '#374151',
    totalBar: '#374151', totalText: '#FFFFFF',
    bodyText: '#111827', dimText: '#6B7280',
  },

  cover(doc, opts) {
    drawCenteredCover(doc, opts, { primary: '#374151', body: '#111827', dim: '#9CA3AF' });
  },

  pageHeader(doc, { pageW, margin, date }) {
    // No coloured band — just a thin rule and small text
    doc.fillColor('#6B7280').fontSize(8).font('Helvetica')
       .text('CSMS', margin, 20);
    doc.fillColor('#9CA3AF').fontSize(8)
       .text(date, pageW - margin - 120, 20, { width: 120, align: 'right' });
    hRule(doc, margin, 34, pageW - margin, '#E5E7EB', 0.5);
  },

  pageFooter(doc, { pageW, margin, projectName, pageNum }) {
    const y = doc.page.height - 36;
    hRule(doc, margin, y, pageW - margin, '#E5E7EB');
    doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica')
       .text(`${projectName} — Confidential`, margin, y + 8)
       .text(`Page ${pageNum}`, margin, y + 8, { width: pageW - margin * 2, align: 'right' });
  },

  sectionHeading(doc, { margin, inner, label }) {
    const y = doc.y;
    doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold')
       .text(label, margin, y, { width: inner });
    const lineY = y + 18;
    hRule(doc, margin, lineY, margin + inner, '#E5E7EB', 0.5);
    doc.y = lineY + 8;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATES: PdfTemplate[] = [classic, executive, modern, bold, minimal];

export const TEMPLATE_MAP: Record<string, PdfTemplate> = Object.fromEntries(
  TEMPLATES.map(t => [t.id, t]),
);

export function getTemplate(id: string): PdfTemplate {
  return TEMPLATE_MAP[id] ?? classic;
}
