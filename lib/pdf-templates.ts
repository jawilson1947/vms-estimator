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

  cover(doc, { pageW, pageH, margin, inner, projectName, projectNumber,
               projectManager, customerName, date, validUntil, grandTotal }) {
    doc.rect(0, 0, pageW, pageH).fill('#1E3A5F');

    doc.fillColor('#FFFFFF').fontSize(28).font('Helvetica-Bold')
       .text('PROPOSAL', margin, 160, { width: inner });
    doc.fillColor('#93C5FD').fontSize(16).font('Helvetica')
       .text(projectName, margin, 204, { width: inner });
    doc.fillColor('#CBD5E1').fontSize(11).font('Helvetica')
       .text(customerName, margin, 232, { width: inner });

    const boxY = 288;
    doc.rect(margin, boxY, inner, 130).fillAndStroke('#FFFFFF11', '#FFFFFF33');
    const rows: [string, string][] = [
      ['Prepared For',    customerName],
      ['Project',         projectName + (projectNumber ? ` (${projectNumber})` : '')],
      ['Project Manager', projectManager ?? '—'],
      ['Date',            date],
      ['Valid Until',     validUntil],
    ];
    rows.forEach(([lbl, val], i) => {
      const ry = boxY + 14 + i * 22;
      doc.fillColor('#93C5FD').fontSize(7.5).font('Helvetica-Bold').text(lbl.toUpperCase(), margin + 16, ry);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica').text(val, margin + 136, ry, { width: inner - 152 });
    });

    if (grandTotal) {
      const ty = boxY + 150;
      doc.rect(margin, ty, inner, 50).fill('#2563EB');
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica')
         .text('INVESTMENT TOTAL', margin + 16, ty + 10, { width: inner - 32 });
      doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold')
         .text(grandTotal, margin + 16, ty + 23, { width: inner - 32 });
    }
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

  cover(doc, { pageW, pageH, margin, inner, projectName, projectNumber,
               projectManager, customerName, date, validUntil, grandTotal }) {
    // White background with slate accent panel on left
    const stripW = 6;
    doc.rect(0, 0, stripW, pageH).fill('#0F172A');
    doc.rect(stripW, 0, pageW - stripW, pageH).fill('#FFFFFF');

    // Company name block
    doc.fillColor('#0F172A').fontSize(13).font('Helvetica-Bold')
       .text('CSMS', margin, 60, { width: inner });
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
       .text('CAMERA & SECURITY MANAGEMENT SYSTEMS', margin, 78, { width: inner });

    // Divider
    hRule(doc, margin, 100, pageW - margin, '#CBD5E1', 1);

    // Project title block
    doc.fillColor('#0F172A').fontSize(26).font('Helvetica-Bold')
       .text(projectName, margin, 120, { width: inner });
    if (projectNumber) {
      doc.fillColor('#64748B').fontSize(11).font('Helvetica')
         .text(`Project No. ${projectNumber}`, margin, 154, { width: inner });
    }
    doc.fillColor('#334155').fontSize(12).font('Helvetica')
       .text(customerName, margin, projectNumber ? 172 : 154, { width: inner });

    // Details grid
    const detY = 220;
    hRule(doc, margin, detY - 8, pageW - margin, '#CBD5E1', 0.5);
    const col1X = margin;
    const col2X = margin + inner / 2;
    const colW  = inner / 2 - 12;
    const detailPairs: [string, string][] = [
      ['Project Manager', projectManager ?? '—'],
      ['Date',            date],
      ['Valid Until',     validUntil],
      ['Prepared For',    customerName],
    ];
    detailPairs.forEach(([lbl, val], i) => {
      const col = i % 2 === 0 ? col1X : col2X;
      const row = Math.floor(i / 2);
      const ry  = detY + row * 42;
      doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica-Bold').text(lbl.toUpperCase(), col, ry);
      doc.fillColor('#0F172A').fontSize(10).font('Helvetica').text(val, col, ry + 12, { width: colW });
    });

    if (grandTotal) {
      const ty = detY + 100;
      hRule(doc, margin, ty - 8, pageW - margin, '#CBD5E1', 0.5);
      doc.fillColor('#64748B').fontSize(8).font('Helvetica')
         .text('TOTAL INVESTMENT', margin, ty + 2);
      doc.fillColor('#0F172A').fontSize(24).font('Helvetica-Bold')
         .text(grandTotal, margin, ty + 16, { width: inner });
    }
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

  cover(doc, { pageW, pageH, margin, inner, projectName, projectNumber,
               projectManager, customerName, date, validUntil, grandTotal }) {
    // Teal top band
    const bandH = 240;
    doc.rect(0, 0, pageW, bandH).fill('#0F766E');
    doc.rect(0, bandH, pageW, pageH - bandH).fill('#FFFFFF');

    // Company name in band
    doc.fillColor('#CCFBF1').fontSize(11).font('Helvetica-Bold')
       .text('CSMS  ·  Camera & Security Management Systems', margin, 30, { width: inner });
    doc.fillColor('#FFFFFF').fontSize(26).font('Helvetica-Bold')
       .text(projectName, margin, 60, { width: inner });
    if (projectNumber) {
      doc.fillColor('#99F6E4').fontSize(9).font('Helvetica')
         .text(`Project No. ${projectNumber}`, margin, 96, { width: inner });
    }
    doc.fillColor('#CCFBF1').fontSize(12).font('Helvetica')
       .text(customerName, margin, projectNumber ? 112 : 96, { width: inner });

    // Teal tab for "PROPOSAL"
    doc.rect(margin, bandH - 40, 110, 40).fill('#0D9488');
    doc.fillColor('#FFFFFF').fontSize(13).font('Helvetica-Bold')
       .text('PROPOSAL', margin + 10, bandH - 28);

    // Details in white section
    const detY = bandH + 24;
    const rows: [string, string][] = [
      ['Prepared For',    customerName],
      ['Project Manager', projectManager ?? '—'],
      ['Date',            date],
      ['Valid Until',     validUntil],
    ];
    rows.forEach(([lbl, val], i) => {
      const ry = detY + i * 28;
      doc.fillColor('#0F766E').fontSize(7.5).font('Helvetica-Bold').text(lbl.toUpperCase(), margin, ry);
      doc.fillColor('#111827').fontSize(10).font('Helvetica').text(val, margin, ry + 11, { width: inner });
    });

    if (grandTotal) {
      const ty = detY + rows.length * 28 + 12;
      doc.rect(margin, ty, inner, 52).fill('#F0FDFA');
      doc.rect(margin, ty, 4, 52).fill('#0D9488');
      doc.fillColor('#0F766E').fontSize(8).font('Helvetica-Bold')
         .text('INVESTMENT TOTAL', margin + 14, ty + 10);
      doc.fillColor('#134E4A').fontSize(22).font('Helvetica-Bold')
         .text(grandTotal, margin + 14, ty + 24, { width: inner - 28 });
    }
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

  cover(doc, { pageW, pageH, margin, inner, projectName, projectNumber,
               projectManager, customerName, date, validUntil, grandTotal }) {
    doc.rect(0, 0, pageW, pageH).fill('#2E1065');
    // Decorative amber diagonal stripe
    doc.polygon([0, pageH - 120], [pageW, pageH - 200], [pageW, pageH - 160], [0, pageH - 80])
       .fill('#F59E0B');
    // Lighter purple panel at bottom
    doc.rect(0, pageH - 80, pageW, 80).fill('#1C0A4A');

    doc.fillColor('#DDD6FE').fontSize(10).font('Helvetica-Bold')
       .text('CSMS  ·  Camera & Security Management Systems', margin, 44, { width: inner });
    doc.fillColor('#FFFFFF').fontSize(30).font('Helvetica-Bold')
       .text('PROPOSAL', margin, 72, { width: inner });
    doc.fillColor('#C4B5FD').fontSize(15).font('Helvetica')
       .text(projectName, margin, 114, { width: inner });
    if (projectNumber) {
      doc.fillColor('#A78BFA').fontSize(9).font('Helvetica')
         .text(`Project No. ${projectNumber}`, margin, 138, { width: inner });
    }
    doc.fillColor('#DDD6FE').fontSize(11).font('Helvetica')
       .text(customerName, margin, projectNumber ? 155 : 138, { width: inner });

    // Details box
    const boxY = 210;
    doc.rect(margin, boxY, inner, 130).fillAndStroke('#FFFFFF08', '#FFFFFF22');
    const rows: [string, string][] = [
      ['Prepared For',    customerName],
      ['Project',         projectName + (projectNumber ? ` (${projectNumber})` : '')],
      ['Project Manager', projectManager ?? '—'],
      ['Date',            date],
      ['Valid Until',     validUntil],
    ];
    rows.forEach(([lbl, val], i) => {
      const ry = boxY + 14 + i * 22;
      doc.fillColor('#A78BFA').fontSize(7.5).font('Helvetica-Bold').text(lbl.toUpperCase(), margin + 16, ry);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica').text(val, margin + 136, ry, { width: inner - 152 });
    });

    if (grandTotal) {
      const ty = boxY + 150;
      doc.rect(margin, ty, inner, 50).fill('#7C3AED');
      doc.fillColor('#EDE9FE').fontSize(9).font('Helvetica')
         .text('INVESTMENT TOTAL', margin + 16, ty + 10, { width: inner - 32 });
      doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold')
         .text(grandTotal, margin + 16, ty + 23, { width: inner - 32 });
    }
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

  cover(doc, { pageW, pageH, margin, inner, projectName, projectNumber,
               projectManager, customerName, date, validUntil, grandTotal }) {
    // Pure white — no fill needed
    doc.fillColor('#9CA3AF').fontSize(9).font('Helvetica')
       .text('CSMS  ·  Camera & Security Management Systems', margin, 50, { width: inner });

    hRule(doc, margin, 68, pageW - margin, '#E5E7EB', 0.5);

    doc.fillColor('#111827').fontSize(30).font('Helvetica-Bold')
       .text('PROPOSAL', margin, 84, { width: inner });
    doc.fillColor('#374151').fontSize(14).font('Helvetica')
       .text(projectName, margin, 125, { width: inner });
    if (projectNumber) {
      doc.fillColor('#9CA3AF').fontSize(10).font('Helvetica')
         .text(`No. ${projectNumber}`, margin, 147, { width: inner });
    }

    hRule(doc, margin, projectNumber ? 168 : 148, pageW - margin, '#E5E7EB', 0.5);

    const detY = projectNumber ? 180 : 160;
    const rows: [string, string][] = [
      ['Prepared For',    customerName],
      ['Project Manager', projectManager ?? '—'],
      ['Date',            date],
      ['Valid Until',     validUntil],
    ];
    rows.forEach(([lbl, val], i) => {
      const ry = detY + i * 30;
      doc.fillColor('#9CA3AF').fontSize(7.5).font('Helvetica-Bold').text(lbl.toUpperCase(), margin, ry);
      doc.fillColor('#111827').fontSize(10).font('Helvetica').text(val, margin, ry + 12, { width: inner });
    });

    if (grandTotal) {
      const ty = detY + rows.length * 30 + 16;
      hRule(doc, margin, ty - 4, pageW - margin, '#E5E7EB', 0.5);
      doc.fillColor('#9CA3AF').fontSize(7.5).font('Helvetica-Bold')
         .text('INVESTMENT TOTAL', margin, ty + 6);
      doc.fillColor('#111827').fontSize(24).font('Helvetica-Bold')
         .text(grandTotal, margin, ty + 20, { width: inner });
    }
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
