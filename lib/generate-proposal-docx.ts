/**
 * Word document (.docx) proposal generator.
 * Five design templates; accepts company branding from user settings.
 * Requires: npm install docx
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, HeadingLevel, ImageRun, ExternalHyperlink,
  TabStopType, TabStopPosition,
} from 'docx';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';
import type { ProposalProjectData } from '@/lib/generate-proposal-pdf';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompanySettings {
  companyName?:           string | null;
  companyTagline?:        string | null;
  logoUrl?:               string | null;
  companyPhone?:          string | null;
  companyAddress?:        string | null;
  companyWebsite?:        string | null;
  defaultProjectManager?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_W    = 12240;  // 8.5 in DXA
const PAGE_H    = 15840;  // 11 in DXA
const MARGIN    = 1080;   // 0.75 in
const CONTENT_W = PAGE_W - MARGIN * 2;  // 10080 DXA

// ── Template configs ──────────────────────────────────────────────────────────

interface TemplateConfig {
  id:           string;
  name:         string;
  coverBg:      string;  // hex, no #
  coverText:    string;
  primary:      string;
  accent:       string;
  sectionBg:    string;
  sectionText:  string;
  tableHdr:     string;
  tableHdrText: string;
  catRow:       string;
  catText:      string;
  subRow:       string;
  subText:      string;
  totalRow:     string;
  totalText:    string;
  altRow:       string;
}

const TEMPLATES: Record<string, TemplateConfig> = {
  classic: {
    id: 'classic', name: 'Classic',
    coverBg: '1E3A5F', coverText: 'FFFFFF',
    primary: '1E3A5F', accent: '2563EB',
    sectionBg: '1E3A5F', sectionText: 'FFFFFF',
    tableHdr: '1E3A5F', tableHdrText: 'FFFFFF',
    catRow: 'E8ECF0', catText: '1E3A5F',
    subRow: 'EEF2FF', subText: '1E3A5F',
    totalRow: '2563EB', totalText: 'FFFFFF',
    altRow: 'F8FAFC',
  },
  executive: {
    id: 'executive', name: 'Executive',
    coverBg: '1E293B', coverText: 'FFFFFF',
    primary: '1E293B', accent: '475569',
    sectionBg: '334155', sectionText: 'FFFFFF',
    tableHdr: '1E293B', tableHdrText: 'FFFFFF',
    catRow: 'E2E8F0', catText: '0F172A',
    subRow: 'F1F5F9', subText: '0F172A',
    totalRow: '334155', totalText: 'FFFFFF',
    altRow: 'F8FAFC',
  },
  modern: {
    id: 'modern', name: 'Modern',
    coverBg: '0F766E', coverText: 'FFFFFF',
    primary: '0F766E', accent: '0D9488',
    sectionBg: '0F766E', sectionText: 'FFFFFF',
    tableHdr: '0F766E', tableHdrText: 'FFFFFF',
    catRow: 'CCFBF1', catText: '134E4A',
    subRow: 'F0FDFA', subText: '134E4A',
    totalRow: '0D9488', totalText: 'FFFFFF',
    altRow: 'F0FDFA',
  },
  bold: {
    id: 'bold', name: 'Bold',
    coverBg: '4C1D95', coverText: 'FFFFFF',
    primary: '4C1D95', accent: '7C3AED',
    sectionBg: '4C1D95', sectionText: 'FFFFFF',
    tableHdr: '4C1D95', tableHdrText: 'FFFFFF',
    catRow: 'EDE9FE', catText: '2E1065',
    subRow: 'F5F3FF', subText: '2E1065',
    totalRow: '7C3AED', totalText: 'FFFFFF',
    altRow: 'FAF5FF',
  },
  minimal: {
    id: 'minimal', name: 'Minimal',
    coverBg: 'FFFFFF', coverText: '111827',
    primary: '111827', accent: '374151',
    sectionBg: 'F3F4F6', sectionText: '111827',
    tableHdr: '374151', tableHdrText: 'FFFFFF',
    catRow: 'F3F4F6', catText: '111827',
    subRow: 'F9FAFB', subText: '374151',
    totalRow: '374151', totalText: 'FFFFFF',
    altRow: 'F9FAFB',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function n(v: unknown): number {
  return Number(v ?? 0);
}

function cellBorder(color = 'D1D5DB') {
  const b = { style: BorderStyle.SINGLE, size: 1, color };
  return { top: b, bottom: b, left: b, right: b };
}

function shading(fill: string) {
  return { fill, type: ShadingType.CLEAR, color: 'auto' };
}

function cell(
  content: string | Paragraph[],
  opts: {
    width: number; bold?: boolean; color?: string; bg?: string;
    align?: typeof AlignmentType[keyof typeof AlignmentType];
    fontSize?: number;
  },
): TableCell {
  const para = typeof content === 'string'
    ? new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [new TextRun({
          text:  content,
          bold:  opts.bold,
          color: opts.color ?? '111827',
          size:  (opts.fontSize ?? 9) * 2,
          font:  'Arial',
        })],
      })
    : content[0];

  return new TableCell({
    width:   { size: opts.width, type: WidthType.DXA },
    borders: cellBorder(),
    shading: opts.bg ? shading(opts.bg) : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [para],
  });
}

async function fetchLogoBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

function guessImageType(url: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'gif') return 'gif';
  if (ext === 'bmp') return 'bmp';
  return 'png';
}

// ── Cover page helpers ────────────────────────────────────────────────────────

function coverPara(
  text: string,
  opts: { size: number; bold?: boolean; color: string; spacing?: number; align?: typeof AlignmentType[keyof typeof AlignmentType] },
): Paragraph {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing:   { before: opts.spacing ?? 0, after: 0 },
    shading:   undefined,
    children:  [new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size * 2, font: 'Arial' })],
  });
}

// ── Section heading ───────────────────────────────────────────────────────────

function sectionHeading(label: string, tmpl: TemplateConfig): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    shading: shading(tmpl.sectionBg),
    indent:  { left: 100, right: 100 },
    children: [new TextRun({
      text:  label.toUpperCase(),
      bold:  true,
      color: tmpl.sectionText,
      size:  22,
      font:  'Arial',
    })],
  });
}

// ── Cost table ────────────────────────────────────────────────────────────────
// Column widths (sum = CONTENT_W = 10080)
const COL = { desc: 5780, qty: 600, unit: 1700, total: 2000 };

function costTable(project: ProposalProjectData, tmpl: TemplateConfig): Table {
  const rows: TableRow[] = [];

  // Header row
  rows.push(new TableRow({
    children: [
      cell('Description', { width: COL.desc,  bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
      cell('Qty',          { width: COL.qty,   bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr, align: AlignmentType.RIGHT }),
      cell('Unit Cost',    { width: COL.unit,  bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr, align: AlignmentType.RIGHT }),
      cell('Line Total',   { width: COL.total, bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr, align: AlignmentType.RIGHT }),
    ],
  }));

  // Group by category
  const grouped = new Map<string, typeof project.costs>();
  for (const c of project.costs) {
    const k = c.category.name;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(c);
  }

  let rowIdx = 0;
  for (const [catName, items] of grouped) {
    // Category header spanning all columns
    rows.push(new TableRow({
      children: [new TableCell({
        columnSpan: 4,
        width:    { size: CONTENT_W, type: WidthType.DXA },
        borders:  cellBorder(),
        shading:  shading(tmpl.catRow),
        margins:  { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({
          children: [new TextRun({ text: catName, bold: true, color: tmpl.catText, size: 18, font: 'Arial' })],
        })],
      })],
    }));

    const catSubtotal = items.reduce((s, c) => s + n(c.lineTotal), 0);

    for (const c of items) {
      const bg = rowIdx % 2 === 1 ? tmpl.altRow : 'FFFFFF';
      rows.push(new TableRow({
        children: [
          cell((c.description ?? '—').substring(0, 80), { width: COL.desc,  bg }),
          cell(String(n(c.quantity)),                    { width: COL.qty,   bg, align: AlignmentType.RIGHT }),
          cell(fmt(n(c.unitCost)),                       { width: COL.unit,  bg, align: AlignmentType.RIGHT }),
          cell(fmt(n(c.lineTotal)),                      { width: COL.total, bg, align: AlignmentType.RIGHT }),
        ],
      }));
      rowIdx++;
    }

    // Subtotal row
    rows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 3,
          width:   { size: COL.desc + COL.qty + COL.unit, type: WidthType.DXA },
          borders: cellBorder(),
          shading: shading(tmpl.subRow),
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children:  [new TextRun({ text: `${catName} Subtotal`, bold: true, color: tmpl.subText, size: 18, font: 'Arial' })],
          })],
        }),
        cell(fmt(catSubtotal), { width: COL.total, bold: true, color: tmpl.subText, bg: tmpl.subRow, align: AlignmentType.RIGHT }),
      ],
    }));
  }

  // Fee summary
  if (project.feeSummary) {
    const fs = project.feeSummary;
    const feeRows: [string, number][] = ([
      ['Direct Cost Total',      n(fs.directCostTotal)],
      [`Overhead (${n(fs.overheadPercent).toFixed(1)}%)`, n(fs.overheadAmount)],
      ['Consulting Fee',         n(fs.consultingFee)],
      ['Project Management Fee', n(fs.projectManagementFee)],
      ['Contingency',            n(fs.contingencyAmount)],
      ['Tax',                    n(fs.taxAmount)],
    ] as [string, number][]).filter(([, v]) => v > 0);

    for (const [label, val] of feeRows) {
      rows.push(new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            width:   { size: COL.desc + COL.qty + COL.unit, type: WidthType.DXA },
            borders: cellBorder(),
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children:  [new TextRun({ text: label, color: '6B7280', size: 16, font: 'Arial' })],
            })],
          }),
          cell(fmt(val), { width: COL.total, color: '111827', align: AlignmentType.RIGHT }),
        ],
      }));
    }

    // Grand total
    rows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 3,
          width:   { size: COL.desc + COL.qty + COL.unit, type: WidthType.DXA },
          borders: cellBorder(),
          shading: shading(tmpl.totalRow),
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children:  [new TextRun({ text: 'GRAND TOTAL', bold: true, color: tmpl.totalText, size: 20, font: 'Arial' })],
          })],
        }),
        cell(fmt(n(fs.grandTotal)), { width: COL.total, bold: true, color: tmpl.totalText, bg: tmpl.totalRow, align: AlignmentType.RIGHT, fontSize: 11 }),
      ],
    }));
  }

  return new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL.desc, COL.qty, COL.unit, COL.total],
    rows,
  });
}

// ── Section body text ─────────────────────────────────────────────────────────

function bodyParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: line, color: '111827', size: 20, font: 'Arial' })],
    }));
}

// ── Main export ───────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<keyof ProposalContent, string> = {
  coverLetter:        'Cover Letter',
  executiveSummary:   'Executive Summary',
  scopeOfWork:        'Scope of Work',
  costBreakdown:      'Cost Breakdown',
  timeline:           'Project Timeline',
  termsAndConditions: 'Terms & Conditions',
};

const SECTION_ORDER: (keyof ProposalContent)[] = [
  'coverLetter', 'executiveSummary', 'scopeOfWork',
  'costBreakdown', 'timeline', 'termsAndConditions',
];

export async function generateProposalDocx(
  content:    ProposalContent,
  project:    ProposalProjectData,
  templateId: string,
  validUntilDate: Date | null,
  company:    CompanySettings = {},
  siteName?:  string | null,
): Promise<Buffer> {
  const tmpl       = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const companyName = company.companyName ?? 'CSMS';
  const tagline     = company.companyTagline ?? 'Camera & Security Management Systems';
  const validStr    = validUntilDate
    ? validUntilDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '30 days from date of issue';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Fetch logo if provided
  let logoBuffer: Buffer | null = null;
  let logoType: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
  if (company.logoUrl) {
    logoBuffer = await fetchLogoBuffer(company.logoUrl);
    logoType   = guessImageType(company.logoUrl);
  }

  const pm         = project.projectManager ?? company.defaultProjectManager ?? '—';
  const isDarkCover = tmpl.coverBg !== 'FFFFFF';

  // ── Cover page children ──────────────────────────────────────────────────────
  const coverChildren: (Paragraph | Table)[] = [];

  // ── Branding block (logo + company name + contact line) ──────────────────────
  if (logoBuffer) {
    coverChildren.push(new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [new ImageRun({
        type:           logoType,
        data:           logoBuffer,
        transformation: { width: 180, height: 68 },
        altText:        { title: companyName, description: companyName, name: companyName },
      })],
    }));
  }

  // Company name — large, prominent
  coverChildren.push(new Paragraph({
    spacing: { before: logoBuffer ? 0 : 480, after: 60 },
    shading: isDarkCover ? shading(tmpl.coverBg) : undefined,
    children: [new TextRun({
      text: companyName.toUpperCase(),
      bold: true, color: isDarkCover ? tmpl.coverText : tmpl.primary,
      size: 56, font: 'Arial',
    })],
  }));

  // Tagline
  if (tagline) {
    coverChildren.push(new Paragraph({
      spacing: { before: 0, after: 120 },
      shading: isDarkCover ? shading(tmpl.coverBg) : undefined,
      children: [new TextRun({ text: tagline, color: isDarkCover ? 'D1D5DB' : '6B7280', size: 20, font: 'Arial' })],
    }));
  }

  // Contact line: phone  |  website  |  address
  const contactParts: string[] = [];
  if (company.companyPhone)   contactParts.push(company.companyPhone);
  if (company.companyWebsite) contactParts.push(company.companyWebsite);
  if (company.companyAddress) contactParts.push(company.companyAddress.replace(/\n/g, ', '));
  if (contactParts.length > 0) {
    coverChildren.push(new Paragraph({
      spacing: { before: 0, after: 360 },
      shading: isDarkCover ? shading(tmpl.coverBg) : undefined,
      children: [new TextRun({
        text: contactParts.join('   ·   '),
        color: isDarkCover ? 'CBD5E1' : '9CA3AF',
        size: 16, font: 'Arial',
      })],
    }));
  }

  // ── Divider ───────────────────────────────────────────────────────────────────
  coverChildren.push(new Paragraph({
    spacing: { before: 0, after: 400 },
    border:  { bottom: { style: BorderStyle.SINGLE, size: 6, color: tmpl.accent, space: 1 } },
    children: [],
  }));

  // ── Project details ───────────────────────────────────────────────────────────
  coverChildren.push(
    coverPara('PROPOSAL', { size: 34, bold: true, color: isDarkCover ? tmpl.coverText : tmpl.primary, spacing: 0 }),
    coverPara(project.projectName, { size: 28, bold: true, color: isDarkCover ? 'FFFFFF' : '111827', spacing: 100 }),
    coverPara(project.customer.customerName, { size: 20, color: isDarkCover ? 'CBD5E1' : '374151', spacing: 40 }),
  );

  // Project Manager — shown prominently
  coverChildren.push(new Paragraph({
    spacing: { before: 200, after: 0 },
    children: [
      new TextRun({ text: 'PROJECT MANAGER:  ', bold: true, color: isDarkCover ? 'CBD5E1' : '6B7280', size: 16, font: 'Arial' }),
      new TextRun({ text: pm, bold: true, color: isDarkCover ? 'FFFFFF' : '111827', size: 18, font: 'Arial' }),
    ],
  }));

  // Other details
  const details: [string, string][] = [
    ['Prepared For',  project.customer.customerName],
    ...(siteName ? [['Project Site', siteName] as [string, string]] : []),
    ['Project No.',   project.projectNumber ?? '—'],
    ['Date',          dateStr],
    ['Valid Until',   validStr],
  ].filter(([, v]) => v && v !== '—') as [string, string][];

  coverChildren.push(new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }));
  for (const [label, value] of details) {
    coverChildren.push(new Paragraph({
      spacing: { before: 80, after: 0 },
      children: [
        new TextRun({ text: `${label.toUpperCase()}:  `, bold: true, color: isDarkCover ? 'CBD5E1' : '6B7280', size: 16, font: 'Arial' }),
        new TextRun({ text: value, color: isDarkCover ? 'FFFFFF' : '111827', size: 16, font: 'Arial' }),
      ],
    }));
  }

  if (project.feeSummary) {
    const gt = fmt(n(project.feeSummary.grandTotal));
    coverChildren.push(
      new Paragraph({ spacing: { before: 360, after: 0 }, children: [] }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        shading: shading(tmpl.accent),
        indent:  { left: 100, right: 100 },
        children: [
          new TextRun({ text: 'INVESTMENT TOTAL  ', bold: true, color: 'FFFFFF', size: 20, font: 'Arial' }),
          new TextRun({ text: gt, bold: true, color: 'FFFFFF', size: 28, font: 'Arial' }),
        ],
      }),
    );
  }

  // Page break after cover
  coverChildren.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Content sections ──────────────────────────────────────────────────────────
  const contentChildren: (Paragraph | Table)[] = [];

  for (const key of SECTION_ORDER) {
    const text    = content[key];
    const hasCosts = key === 'costBreakdown' && project.costs.length > 0;
    if ((!text || text.trim() === '') && !hasCosts) continue;

    contentChildren.push(sectionHeading(SECTION_LABELS[key], tmpl));

    if (text && text.trim()) {
      contentChildren.push(...bodyParagraphs(text));
    }

    if (key === 'costBreakdown' && project.costs.length > 0) {
      contentChildren.push(
        new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
        costTable(project, tmpl),
        new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
      );
    }
  }

  // ── Header / Footer ───────────────────────────────────────────────────────────
  const header = new Header({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      border:   { bottom: { style: BorderStyle.SINGLE, size: 4, color: tmpl.primary, space: 1 } },
      children: [
        new TextRun({ text: companyName, bold: true, color: tmpl.primary, size: 18, font: 'Arial' }),
        new TextRun({ text: `	${dateStr}`, color: '6B7280', size: 16, font: 'Arial' }),
      ],
    })],
  });

  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      border:   { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 1 } },
      children: [
        new TextRun({ text: `${project.projectName} — Confidential`, color: '9CA3AF', size: 16, font: 'Arial' }),
        new TextRun({ text: '\tPage ', color: '9CA3AF', size: 16, font: 'Arial' }),
        new TextRun({ children: [PageNumber.CURRENT], color: '9CA3AF', size: 16, font: 'Arial' }),
      ],
    })],
  });

  // ── Document ──────────────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20 } },
      },
    },
    sections: [
      // Cover section (no header/footer)
      {
        properties: {
          page: {
            size:   { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children: coverChildren,
      },
      // Content section (with header/footer)
      {
        properties: {
          page: {
            size:   { width: PAGE_W, height: PAGE_H },
            margin: { top: 1200, right: MARGIN, bottom: 1200, left: MARGIN },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: contentChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
