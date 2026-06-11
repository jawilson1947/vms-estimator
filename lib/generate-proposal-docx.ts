/**
 * Word document (.docx) proposal generator.
 * Five design templates; accepts company branding from user settings.
 * Requires: npm install docx
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, ImageRun, ExternalHyperlink,
  TabStopType, TabStopPosition,
} from 'docx';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';
import type { ProposalProjectData, ProposalCameraLocation } from '@/lib/generate-proposal-pdf';
import { buildCostSchedule, substituteCostTokens } from '@/lib/cost-schedule';

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
  coverLetter:        'Introduction',
  executiveSummary:   'Executive Summary',
  scopeOfWork:        'Scope of Work',
  costBreakdown:      'Cost Schedule',
  timeline:           'Project Timeline',
  termsAndConditions: 'Terms & Conditions',
};

const SECTION_ORDER: (keyof ProposalContent)[] = [
  'coverLetter', 'executiveSummary', 'scopeOfWork',
  'costBreakdown', 'timeline', 'termsAndConditions',
];

export async function generateProposalDocx(
  content:      ProposalContent,
  project:      ProposalProjectData,
  templateId:   string,
  validUntilDate: Date | null,
  company:      CompanySettings = {},
  siteName?:    string | null,
  buildingName?: string | null,
): Promise<Buffer> {
  const tmpl       = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const companyName = company.companyName ?? 'CSMS';
  const tagline     = company.companyTagline ?? 'Camera & Security Management Systems';

  // Compute live cost schedule once — keeps cover Investment Total and the Cost
  // Schedule table in sync regardless of what is stored in feeSummary.
  const liveSchedule = buildCostSchedule(
    (project.cameraLocations ?? []) as Parameters<typeof buildCostSchedule>[0],
    project.costs               as Parameters<typeof buildCostSchedule>[1],
    project.feeSummary          as Parameters<typeof buildCostSchedule>[2],
  );
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


  // ── Cover page children — centered white layout ───────────────────────────────
  const coverChildren: (Paragraph | Table)[] = [];

  // Helper: centered paragraph
  function cPara(text: string, opts: { size: number; bold?: boolean; color: string; spacingBefore?: number; spacingAfter?: number }) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { before: opts.spacingBefore ?? 0, after: opts.spacingAfter ?? 80 },
      children:  [new TextRun({ text, bold: opts.bold ?? false, color: opts.color, size: opts.size, font: 'Arial' })],
    });
  }

  // Helper: centered rule (paragraph border bottom)
  function cRule(spacingBefore = 160, spacingAfter = 160) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { before: spacingBefore, after: spacingAfter },
      border:    { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB', space: 1 } },
      children:  [],
    });
  }

  // ── Logo ──────────────────────────────────────────────────────────────────────
  if (logoBuffer) {
    coverChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { before: 480, after: 160 },
      children:  [new ImageRun({
        type:           logoType,
        data:           logoBuffer,
        transformation: { width: 140, height: 52 },
        altText:        { title: companyName, description: companyName, name: companyName },
      })],
    }));
  }

  // ── Company block ─────────────────────────────────────────────────────────────
  coverChildren.push(cPara(companyName, { size: 28, bold: true, color: tmpl.primary, spacingBefore: logoBuffer ? 0 : 480, spacingAfter: 80 }));

  if (tagline) {
    coverChildren.push(cPara(tagline, { size: 18, color: '6B7280', spacingAfter: 80 }));
  }

  if (company.companyAddress) {
    for (const line of company.companyAddress.split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, 3)) {
      coverChildren.push(cPara(line, { size: 17, color: '9CA3AF', spacingAfter: 60 }));
    }
  }

  if (company.companyPhone || company.companyWebsite) {
    const phoneWeb = [company.companyPhone, company.companyWebsite].filter(Boolean).join('   |   ');
    coverChildren.push(cPara(phoneWeb!, { size: 17, color: '9CA3AF', spacingAfter: 80 }));
  }

  coverChildren.push(cRule(160, 200));

  // ── Proposal section ──────────────────────────────────────────────────────────
  coverChildren.push(
    cPara('Proposal', { size: 16, bold: true, color: tmpl.primary, spacingAfter: 120 }),
    cPara(project.customer.customerName, { size: 36, bold: true, color: '111827', spacingAfter: 80 }),
    ...(siteName ? [cPara(siteName, { size: 22, color: '374151', spacingAfter: 60 })] : []),
    cPara(project.projectName, { size: 24, bold: true, color: '111827', spacingAfter: 80 }),
    ...(buildingName ? [cPara(buildingName, { size: 18, color: '374151', spacingAfter: 60 })] : []),
  );
  if (project.projectNumber) {
    coverChildren.push(cPara(`Project No. ${project.projectNumber}`, { size: 18, color: '6B7280', spacingAfter: 80 }));
  }

  coverChildren.push(cRule(160, 200));

  // ── Prepared for section ─────────────────────────────────────────────────────
  coverChildren.push(
    cPara('Prepared for:', { size: 16, bold: true, color: tmpl.primary, spacingAfter: 120 }),
    cPara(pm, { size: 24, bold: true, color: '111827', spacingAfter: 80 }),
  );

  coverChildren.push(cRule(160, 200));

  // ── Project summary section ───────────────────────────────────────────────────
  const projectSummaryText = content.executiveSummary
    ? (content.executiveSummary.split(/\n\n+/).find((p: string) => p.trim()) ?? '').trim().slice(0, 400)
    : '';
  if (projectSummaryText) {
    coverChildren.push(
      cPara('Project Summary', { size: 16, bold: true, color: tmpl.primary, spacingAfter: 120 }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing:   { before: 0, after: 160 },
        children:  [new TextRun({ text: projectSummaryText, color: '6B7280', size: 17, font: 'Arial' })],
      }),
    );
    coverChildren.push(cRule(160, 200));
  }

  // ── Date section ──────────────────────────────────────────────────────────────
  coverChildren.push(
    cPara('Date', { size: 16, bold: true, color: tmpl.primary, spacingAfter: 120 }),
    cPara(dateStr, { size: 20, color: '111827', spacingAfter: 80 }),
    cPara(`Valid Until: ${validStr}`, { size: 18, color: '6B7280', spacingAfter: 80 }),
  );

  // ── Investment total — prefer live schedule; fall back to saved feeSummary ────
  const coverGrandTotal = liveSchedule.groups.length > 0
    ? liveSchedule.grandTotal
    : project.feeSummary ? n(project.feeSummary.grandTotal) : null;
  if (coverGrandTotal !== null && coverGrandTotal > 0) {
    coverChildren.push(
      cRule(160, 200),
      cPara('Investment Total', { size: 16, bold: true, color: tmpl.primary, spacingAfter: 120 }),
      cPara(fmt(coverGrandTotal), { size: 48, bold: true, color: tmpl.primary, spacingAfter: 80 }),
    );
  }

  // ── Confidentiality statement ─────────────────────────────────────────────────
  const confText = 'This proposal contains confidential and proprietary information intended solely for the use of the named recipient. No part of this document may be reproduced, distributed, or disclosed without the written consent of the principal investigator.';
  coverChildren.push(
    cRule(240, 160),
    cPara('Confidentiality Statement', { size: 16, bold: true, color: tmpl.primary, spacingAfter: 100 }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { before: 0, after: 160 },
      children:  [new TextRun({ text: confText, color: '9CA3AF', size: 16, font: 'Arial' })],
    }),
  );

  // Page break after cover
  coverChildren.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Content sections ──────────────────────────────────────────────────────────
  const contentChildren: (Paragraph | Table)[] = [];

  for (const key of SECTION_ORDER) {
    // -- Cost Schedule (programmatic table, no AI text) --
    if (key === 'costBreakdown') {
      const schedule = liveSchedule;   // computed once above — same data as cover total
      if (schedule.groups.length === 0) continue;

      // Column widths (sum = CONTENT_W = 10080 DXA)
      const SC = { cat: 1400, desc: 4280, qty: 500, unit: 1600, mkup: 700, tot: 1600 };

      const csRows: TableRow[] = [
        // Header row
        new TableRow({ children: [
          cell('Category',    { width: SC.cat,  bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
          cell('Description', { width: SC.desc, bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
          cell('Qty',         { width: SC.qty,  bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr, align: AlignmentType.RIGHT }),
          cell('Unit Cost',   { width: SC.unit, bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr, align: AlignmentType.RIGHT }),
          cell('Markup',      { width: SC.mkup, bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr, align: AlignmentType.RIGHT }),
          cell('Line Total',  { width: SC.tot,  bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr, align: AlignmentType.RIGHT }),
        ]}),
      ];

      let prevCat = '';
      let rowIdx  = 0;
      for (const g of schedule.groups) {
        if (g.category !== prevCat) {
          csRows.push(new TableRow({ children: [
            new TableCell({
              columnSpan: 6,
              width:   { size: CONTENT_W, type: WidthType.DXA },
              borders: cellBorder(),
              shading: shading(tmpl.catRow),
              margins: { top: 50, bottom: 50, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: g.category, bold: true, color: tmpl.catText, size: 17, font: 'Arial' })] })],
            }),
          ]}));
          prevCat = g.category;
        }
        const bg = rowIdx % 2 === 1 ? tmpl.altRow : 'FFFFFF';
        csRows.push(new TableRow({ children: [
          cell('',                                { width: SC.cat,  bg }),
          cell(g.description.substring(0, 80),    { width: SC.desc, bg }),
          cell(String(g.quantity),                { width: SC.qty,  bg, align: AlignmentType.RIGHT }),
          cell(fmt(g.unitCost),                   { width: SC.unit, bg, align: AlignmentType.RIGHT }),
          cell(g.markupPercent > 0 ? `${g.markupPercent}%` : '—', { width: SC.mkup, bg, align: AlignmentType.RIGHT }),
          cell(fmt(g.lineTotal),                  { width: SC.tot,  bg, align: AlignmentType.RIGHT }),
        ]}));
        rowIdx++;
      }

      // Fee summary rows
      const feeRows: [string, number][] = ([
        ['Direct Cost Total',                              schedule.directTotal],
        [`Overhead (${schedule.overheadPercent.toFixed(1)}%)`, schedule.overheadAmount],
        ['Consulting Fee',                                 schedule.consultingFee],
        ['Project Management Fee',                        schedule.projectManagementFee],
        ['Contingency',                                    schedule.contingencyAmount],
        ['Tax',                                            schedule.taxAmount],
      ] as [string, number][]).filter(([, v]) => v > 0);

      for (const [label, val] of feeRows) {
        csRows.push(new TableRow({ children: [
          new TableCell({
            columnSpan: 5,
            width:   { size: SC.cat + SC.desc + SC.qty + SC.unit + SC.mkup, type: WidthType.DXA },
            borders: cellBorder(),
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: label, color: '6B7280', size: 16, font: 'Arial' })] })],
          }),
          cell(fmt(val), { width: SC.tot, align: AlignmentType.RIGHT }),
        ]}));
      }

      // Grand total row
      csRows.push(new TableRow({ children: [
        new TableCell({
          columnSpan: 5,
          width:   { size: SC.cat + SC.desc + SC.qty + SC.unit + SC.mkup, type: WidthType.DXA },
          borders: cellBorder(),
          shading: shading(tmpl.totalRow),
          margins: { top: 70, bottom: 70, left: 100, right: 100 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'GRAND TOTAL', bold: true, color: tmpl.totalText, size: 18, font: 'Arial' })] })],
        }),
        cell(fmt(schedule.grandTotal), { width: SC.tot, bold: true, color: tmpl.totalText, bg: tmpl.totalRow, align: AlignmentType.RIGHT, fontSize: 10 }),
      ]}));

      contentChildren.push(
        sectionHeading(SECTION_LABELS[key], tmpl),
        new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [SC.cat, SC.desc, SC.qty, SC.unit, SC.mkup, SC.tot], rows: csRows }),
        new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
      );
      continue;
    }

    // -- Regular text sections --
    const text = substituteCostTokens(content[key] ?? '', liveSchedule);
    if (!text || text.trim() === '') continue;

    contentChildren.push(sectionHeading(SECTION_LABELS[key], tmpl));
    contentChildren.push(...bodyParagraphs(text));
  }

  // ── Survey Summary (camera locations) ────────────────────────────────────────
  const surveyLocs = (project.cameraLocations ?? []).filter(
    (l: ProposalCameraLocation) => l.areaName || l.floor || l.cameraModel,
  );
  if (surveyLocs.length > 0) {
    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      sectionHeading('Survey Summary', tmpl),
      new Paragraph({
        spacing: { before: 0, after: 200 },
        children: [new TextRun({
          text: 'The following camera locations were recorded during the site survey and form the basis of this proposal.',
          color: '374151', size: 20, font: 'Arial',
        })],
      }),
    );

    // Column widths (sum = CONTENT_W = 10080)
    const SC = { area: 2800, model: 2600, type: 1400, env: 1280, coverage: 2000 };

    const surveyRows: TableRow[] = [
      new TableRow({
        children: [
          cell('Area / Floor',    { width: SC.area,     bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
          cell('Camera Model',    { width: SC.model,    bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
          cell('Type',            { width: SC.type,     bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
          cell('Env.',            { width: SC.env,      bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
          cell('Coverage Purpose',{ width: SC.coverage, bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
        ],
      }),
    ];

    surveyLocs.forEach((loc: ProposalCameraLocation, idx: number) => {
      const bg        = idx % 2 === 1 ? tmpl.altRow : 'FFFFFF';
      const area      = [loc.floor, loc.areaName].filter(Boolean).join(' – ') || '—';
      const modelStr  = loc.cameraModel
        ? [loc.cameraModel.manufacturer, loc.cameraModel.model].filter(Boolean).join(' ') || '—'
        : '—';
      const typeStr   = loc.cameraModel?.cameraType    || '—';
      const envStr    = loc.cameraModel?.indoorOutdoor || '—';
      const coverage  = loc.coveragePurpose || loc.mountingLocation || '—';

      surveyRows.push(new TableRow({
        children: [
          cell(area,     { width: SC.area,     bg }),
          cell(modelStr, { width: SC.model,    bg }),
          cell(typeStr,  { width: SC.type,     bg }),
          cell(envStr,   { width: SC.env,      bg }),
          cell(coverage, { width: SC.coverage, bg }),
        ],
      }));
    });

    // Total footer row spanning all columns
    surveyRows.push(new TableRow({
      children: [new TableCell({
        columnSpan: 5,
        width:   { size: CONTENT_W, type: WidthType.DXA },
        borders: cellBorder(),
        shading: shading(tmpl.subRow),
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({
          children: [new TextRun({
            text: `Total camera locations surveyed: ${surveyLocs.length}`,
            bold: true, color: tmpl.subText, size: 18, font: 'Arial',
          })],
        })],
      })],
    }));

    contentChildren.push(
      new Table({
        width:        { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [SC.area, SC.model, SC.type, SC.env, SC.coverage],
        rows:         surveyRows,
      }),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
    );
  }

  // ── Signatory section ────────────────────────────────────────────────────────
  contentChildren.push(
    new Paragraph({ children: [new PageBreak()] }),
    sectionHeading('Acceptance of Proposal', tmpl),
    new Paragraph({
      spacing: { before: 0, after: 240 },
      children: [new TextRun({
        text: 'The undersigned hereby accepts the terms, scope, and pricing outlined in this proposal and authorizes commencement of the described work.',
        color: '374151', size: 20, font: 'Arial',
      })],
    }),
  );

  // Two-column signature table
  const SIG_COL = Math.floor(CONTENT_W / 2) - 200;
  const sigFields = ['Signature', 'Printed Name', 'Title', 'Date'];
  const sigHeaders = new TableRow({
    children: [
      new TableCell({
        width: { size: SIG_COL, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [new Paragraph({
          children: [new TextRun({ text: 'Authorized by (Client)', bold: true, color: tmpl.primary, size: 18, font: 'Arial' })],
        })],
      }),
      new TableCell({
        width: { size: 400, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [new Paragraph({ children: [] })],
      }),
      new TableCell({
        width: { size: SIG_COL, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [new Paragraph({
          children: [new TextRun({ text: 'Authorized by (Vendor)', bold: true, color: tmpl.primary, size: 18, font: 'Arial' })],
        })],
      }),
    ],
  });

  const sigRows: TableRow[] = [sigHeaders];
  for (const field of sigFields) {
    sigRows.push(new TableRow({
      children: [
        new TableCell({
          width: { size: SIG_COL, type: WidthType.DXA },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          margins: { top: 480, bottom: 60, left: 0, right: 0 },
          children: [new Paragraph({
            children: [new TextRun({ text: field, color: '9CA3AF', size: 16, font: 'Arial' })],
          })],
        }),
        new TableCell({
          width: { size: 400, type: WidthType.DXA },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          children: [new Paragraph({ children: [] })],
        }),
        new TableCell({
          width: { size: SIG_COL, type: WidthType.DXA },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          margins: { top: 480, bottom: 60, left: 0, right: 0 },
          children: [new Paragraph({
            children: [new TextRun({ text: field, color: '9CA3AF', size: 16, font: 'Arial' })],
          })],
        }),
      ],
    }));
  }

  contentChildren.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [SIG_COL, 400, SIG_COL],
      rows: sigRows,
    }),
    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
  );

  // ── Appendix A — Reference Links ──────────────────────────────────────────────
  const linkedCosts = project.costs.filter(c => (c as { url?: string | null }).url?.trim());
  if (linkedCosts.length > 0) {
    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      sectionHeading('Appendix A — Reference Links', tmpl),
      new Paragraph({
        spacing: { before: 0, after: 200 },
        children: [new TextRun({
          text: 'The following reference links are associated with line items in this proposal.',
          color: '374151', size: 20, font: 'Arial',
        })],
      }),
    );

    const APP_COL = { num: 360, desc: 3600, url: CONTENT_W - 360 - 3600 };
    const appRows: TableRow[] = [
      new TableRow({
        children: [
          cell('#',           { width: APP_COL.num,  bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
          cell('Description', { width: APP_COL.desc, bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
          cell('URL',         { width: APP_COL.url,  bold: true, color: tmpl.tableHdrText, bg: tmpl.tableHdr }),
        ],
      }),
    ];

    linkedCosts.forEach((c, idx) => {
      const url = (c as { url?: string | null }).url!;
      const bg  = idx % 2 === 1 ? tmpl.altRow : 'FFFFFF';
      appRows.push(new TableRow({
        children: [
          cell(String(idx + 1),       { width: APP_COL.num,  bg }),
          cell(c.description ?? '—',  { width: APP_COL.desc, bg }),
          new TableCell({
            width:   { size: APP_COL.url, type: WidthType.DXA },
            borders: cellBorder(),
            shading: bg ? shading(bg) : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({
              children: [new ExternalHyperlink({
                link: url,
                children: [new TextRun({
                  text:      url,
                  style:     'Hyperlink',
                  color:     '2563EB',
                  size:      16,
                  font:      'Arial',
                  underline: { type: undefined },
                })],
              })],
            })],
          }),
        ],
      }));
    });

    contentChildren.push(
      new Table({
        width:        { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [APP_COL.num, APP_COL.desc, APP_COL.url],
        rows:         appRows,
      }),
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
    );
  }

  // ── Header / Footer ───────────────────────────────────────────────────────────
  const companyLine = [companyName, tagline].filter(Boolean).join('  ·  ');

  const header = new Header({
    children: [new Paragraph({
      border:    { bottom: { style: BorderStyle.SINGLE, size: 4, color: tmpl.accent, space: 4 } },
      spacing:   { before: 0, after: 120 },
      children: [
        new TextRun({ text: companyLine, bold: true, color: tmpl.primary, size: 16, font: 'Arial' }),
        new TextRun({ text: `\t${dateStr}`, color: '9CA3AF', size: 14, font: 'Arial' }),
      ],
    })],
  });

  const footer = new Footer({
    children: [new Paragraph({
      border:    { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB', space: 4 } },
      spacing:   { before: 120, after: 0 },
      children: [
        new TextRun({ text: `${project.projectName}  —  Confidential`, color: '9CA3AF', size: 14, font: 'Arial' }),
        new TextRun({ text: '\t', color: '9CA3AF', size: 14, font: 'Arial' }),
        new TextRun({
          children: ['Page ', PageNumber.CURRENT],
          color: '9CA3AF', size: 14, font: 'Arial',
        }),
      ],
    })],
  });

  // ── Assemble document ─────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      paragraphStyles: [{
        id:   'Hyperlink',
        name: 'Hyperlink',
        run:  { color: '2563EB', underline: { type: undefined } },
      }],
    },
    sections: [
      // Cover page — no header/footer
      {
        properties: {
          page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
        },
        children: coverChildren,
      },
      // Content pages — with header/footer
      {
        properties: {
          page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN + 360, bottom: MARGIN + 360, left: MARGIN, right: MARGIN } },
          titlePage: false,
        },
        headers: { default: header },
        footers: { default: footer },
        children: contentChildren,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
