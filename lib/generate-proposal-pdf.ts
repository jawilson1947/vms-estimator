/**
 * Shared PDF generation logic for proposal documents.
 * Used by both the saved-proposal export route and the stateless preview route.
 */
import PDFDocument from 'pdfkit';
import { getTemplate } from '@/lib/pdf-templates';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';
import { buildCostSchedule } from '@/lib/cost-schedule';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProposalCompanyInfo {
  companyName?:    string | null;
  companyTagline?: string | null;
  companyAddress?: string | null;
  companyPhone?:   string | null;
  companyWebsite?: string | null;
  logoUrl?:        string | null;
}

export interface ProposalCameraLocation {
  floor?:           string | null;
  areaName?:        string | null;
  mountingLocation?: string | null;
  coveragePurpose?: string | null;
  surveyNotes?:     string | null;
  cameraModel?: {
    manufacturer?: string | null;
    model?:        string | null;
    cameraType?:   string | null;
    indoorOutdoor?: string | null;
  } | null;
}

export interface ProposalProjectData {
  projectName:    string;
  projectNumber?: string | null;
  projectManager?: string | null;
  customer: { customerName: string };
  cameraLocations?: (ProposalCameraLocation & {
    cameraModelId?: number | null;
    cameraModel?: (ProposalCameraLocation['cameraModel'] & { cost?: unknown }) | null;
  })[] | null;
  feeSummary: {
    directCostTotal:      number | string | { toString(): string };
    overheadPercent:      number | string | { toString(): string };
    overheadAmount:       number | string | { toString(): string };
    consultingFee:        number | string | { toString(): string };
    projectManagementFee: number | string | { toString(): string };
    contingencyAmount:    number | string | { toString(): string };
    taxAmount:            number | string | { toString(): string };
    grandTotal:           number | string | { toString(): string };
  } | null;
  costs: Array<{
    surveyLocationId?: unknown;
    cameraModelId?:    number | null;
    markupPercent?:    unknown;
    description?:      string | null;
    quantity:          number | string | { toString(): string };
    unitCost:          number | string | { toString(): string };
    lineTotal?:        number | string | { toString(): string } | null;
    url?:              string | null;
    category: { name: string };
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function n(v: number | string | { toString(): string } | null | undefined): number {
  return Number(v ?? 0);
}

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

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateProposalPdf(
  content:        ProposalContent,
  project:        ProposalProjectData,
  templateId:     string,
  validUntilDate: Date | null,
  company:        ProposalCompanyInfo = {},
): Promise<Buffer> {
  const tmpl = getTemplate(templateId);

  const doc    = new PDFDocument({ margin: 50, size: 'LETTER', autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finish = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const pageW  = 612;
  const margin = 50;
  const inner  = pageW - margin * 2;   // 512
  const date   = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const validUntilStr = validUntilDate
    ? validUntilDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '30 days from date of issue';

  let pageNum = 0;

  function newPage() {
    pageNum++;
    doc.addPage();
    tmpl.pageHeader(doc, { pageW, margin, date });
    doc.y = 90;
  }

  function checkPageBreak(needed = 80) {
    if (doc.y + needed > doc.page.height - 60) {
      tmpl.pageFooter(doc, { pageW, margin, projectName: project.projectName, pageNum });
      newPage();
    }
  }

  function drawParagraphs(text: string) {
    const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    doc.fillColor(tmpl.tc.bodyText).fontSize(9.5).font('Helvetica');
    for (const para of paras) {
      doc.text(para, margin, doc.y, { width: inner, align: 'justify', lineGap: 2 });
      doc.moveDown(0.7);
    }
  }

  // ── Cover page ──────────────────────────────────────────────────────────────
  pageNum++;
  doc.addPage();

  const grandTotalStr = project.feeSummary
    ? fmt(n(project.feeSummary.grandTotal))
    : undefined;

  // Fetch logo buffer
  let logoBuffer: Buffer | null = null;
  if (company.logoUrl) {
    try {
      const res = await fetch(company.logoUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer());
    } catch { /* ignore */ }
  }

  // First paragraph of executive summary → project summary on cover
  const projectSummary = content.executiveSummary
    ? (content.executiveSummary.split(/\n\n+/).find(p => p.trim()) ?? '').trim().slice(0, 400) || undefined
    : undefined;

  tmpl.cover(doc, {
    pageW,
    pageH:           doc.page.height,
    margin,
    inner,
    projectName:     project.projectName,
    projectNumber:   project.projectNumber,
    projectManager:  project.projectManager,
    customerName:    project.customer.customerName,
    date,
    validUntil:      validUntilStr,
    grandTotal:      grandTotalStr,
    projectSummary,
    logoBuffer:      logoBuffer ?? undefined,
    siteName:        (project as { siteName?: string | null }).siteName,
    buildingName:    (project as { building?: { buildingName?: string } | null }).building?.buildingName,
    companyName:     company.companyName,
    companyTagline:  company.companyTagline,
    companyAddress:  company.companyAddress,
    companyPhone:    company.companyPhone,
    companyWebsite:  company.companyWebsite,
  });
  tmpl.pageFooter(doc, { pageW, margin, projectName: project.projectName, pageNum });

  // ── Content sections ────────────────────────────────────────────────────────
  for (const key of SECTION_ORDER) {
    // -- Cost Schedule (always programmatic, never AI text) --
    if (key === 'costBreakdown') {
      const schedule = buildCostSchedule(
        (project.cameraLocations ?? []) as Parameters<typeof buildCostSchedule>[0],
        project.costs               as Parameters<typeof buildCostSchedule>[1],
        project.feeSummary          as Parameters<typeof buildCostSchedule>[2],
      );
      if (schedule.groups.length === 0) continue;

      newPage();
      tmpl.sectionHeading(doc, { margin, inner, label: SECTION_LABELS[key] });

      // Column x-positions and widths (sum = inner = 512)
      const cW = { cat: 88, desc: 192, qty: 32, unit: 72, mkup: 44, tot: 84 };
      const cX = {
        cat:  margin,
        desc: margin + cW.cat,
        qty:  margin + cW.cat + cW.desc,
        unit: margin + cW.cat + cW.desc + cW.qty,
        mkup: margin + cW.cat + cW.desc + cW.qty + cW.unit,
        tot:  margin + cW.cat + cW.desc + cW.qty + cW.unit + cW.mkup,
      };

      // Header row
      checkPageBreak(20);
      const hY = doc.y;
      doc.rect(margin, hY, inner, 16).fill(tmpl.tc.tableHdr);
      doc.fillColor(tmpl.tc.tableHdrText).fontSize(7).font('Helvetica-Bold');
      doc.text('Category',    cX.cat  + 2, hY + 4, { width: cW.cat  - 4 });
      doc.text('Description', cX.desc + 2, hY + 4, { width: cW.desc - 4 });
      doc.text('Qty',         cX.qty  + 2, hY + 4, { width: cW.qty  - 4, align: 'right' });
      doc.text('Unit Cost',   cX.unit + 2, hY + 4, { width: cW.unit - 4, align: 'right' });
      doc.text('Markup',      cX.mkup + 2, hY + 4, { width: cW.mkup - 4, align: 'right' });
      doc.text('Line Total',  cX.tot  + 2, hY + 4, { width: cW.tot  - 4, align: 'right' });
      doc.y = hY + 16;

      // Group rows by category
      let prevCat = '';
      let rowIdx = 0;
      for (const g of schedule.groups) {
        if (g.category !== prevCat) {
          checkPageBreak(28);
          const catY = doc.y;
          doc.rect(margin, catY, inner, 14).fill(tmpl.tc.catRow);
          doc.fillColor(tmpl.tc.catRowText).fontSize(7.5).font('Helvetica-Bold')
             .text(g.category, margin + 4, catY + 3, { width: inner - 8 });
          doc.y = catY + 14;
          prevCat = g.category;
        }
        checkPageBreak(14);
        const rowY = doc.y;
        if (rowIdx % 2 === 0) doc.rect(margin, rowY, inner, 13).fill(tmpl.tc.tableAlt);
        const ry = rowY + 3;
        doc.fillColor(tmpl.tc.bodyText).fontSize(7).font('Helvetica');
        doc.text('',                                  cX.cat  + 2, ry, { width: cW.cat  - 4 });
        doc.text(g.description.substring(0, 38),      cX.desc + 2, ry, { width: cW.desc - 4 });
        doc.text(String(g.quantity),                  cX.qty  + 2, ry, { width: cW.qty  - 4, align: 'right' });
        doc.text(fmt(g.unitCost),                     cX.unit + 2, ry, { width: cW.unit - 4, align: 'right' });
        doc.text(g.markupPercent > 0 ? `${g.markupPercent}%` : '—', cX.mkup + 2, ry, { width: cW.mkup - 4, align: 'right' });
        doc.text(fmt(g.lineTotal),                    cX.tot  + 2, ry, { width: cW.tot  - 4, align: 'right' });
        doc.y = rowY + 13;
        rowIdx++;
      }

      // Fee summary rows
      doc.moveDown(0.4);
      const feeRows: [string, number][] = [
        ['Direct Cost Total',                              schedule.directTotal],
        [`Overhead (${schedule.overheadPercent.toFixed(1)}%)`, schedule.overheadAmount],
        ['Consulting Fee',                                 schedule.consultingFee],
        ['Project Management Fee',                        schedule.projectManagementFee],
        ['Contingency',                                    schedule.contingencyAmount],
        ['Tax',                                            schedule.taxAmount],
      ].filter(([, v]) => v > 0) as [string, number][];

      for (const [label, val] of feeRows) {
        checkPageBreak(13);
        const fY = doc.y;
        doc.fillColor(tmpl.tc.dimText ?? '#9CA3AF').fontSize(7.5).font('Helvetica')
           .text(label, margin + inner - 230, fY, { width: 148, align: 'right' });
        doc.fillColor(tmpl.tc.bodyText).fontSize(7.5)
           .text(fmt(val), cX.tot + 2, fY, { width: cW.tot - 4, align: 'right' });
        doc.y = fY + 13;
      }

      // Grand total bar
      checkPageBreak(22);
      const gtY = doc.y + 3;
      doc.rect(margin + inner - 230, gtY, 230, 20).fill(tmpl.tc.totalBar ?? tmpl.tc.tableHdr);
      doc.fillColor(tmpl.tc.totalText ?? '#FFFFFF').fontSize(8).font('Helvetica-Bold')
         .text('GRAND TOTAL', margin + inner - 230 + 2, gtY + 5, { width: 144, align: 'right' });
      doc.fillColor(tmpl.tc.totalText ?? '#FFFFFF').fontSize(8)
         .text(fmt(schedule.grandTotal), cX.tot + 2, gtY + 5, { width: cW.tot - 4, align: 'right' });
      doc.y = gtY + 26;

      tmpl.pageFooter(doc, { pageW, margin, projectName: project.projectName, pageNum });
      continue;
    }

    // -- Regular text sections --
    const text = content[key];
    if (!text || text.trim() === '') continue;

    newPage();
    tmpl.sectionHeading(doc, { margin, inner, label: SECTION_LABELS[key] });
    drawParagraphs(text);
    tmpl.pageFooter(doc, { pageW, margin, projectName: project.projectName, pageNum });
  }

  // ── Survey Summary (camera locations) ────────────────────────────────────────
  const locs = (project.cameraLocations ?? []).filter(
    l => l.areaName || l.floor || l.cameraModel,
  );
  if (locs.length > 0) {
    newPage();
    tmpl.sectionHeading(doc, { margin, inner, label: 'Survey Summary' });
    doc.fillColor(tmpl.tc.bodyText).fontSize(9.5).font('Helvetica');
    doc.text(
      'The following camera locations were recorded during the site survey and form the basis of this proposal.',
      margin, doc.y, { width: inner, lineGap: 2 }
    );
    doc.moveDown(0.6);

    // Column layout: Area/Floor | Camera Model | Type | Env | Coverage
    const sCols  = [margin, margin + 175, margin + 315, margin + 378, margin + 435];
    const sW     = [172, 137, 60, 54, 77];
    const sHdrs  = ['Area / Floor', 'Camera Model', 'Type', 'Env.', 'Coverage Purpose'];

    // Header row
    const shdrY = doc.y;
    doc.rect(margin, shdrY, inner, 18).fill(tmpl.tc.tableHdr);
    doc.fillColor(tmpl.tc.tableHdrText).fontSize(7.5).font('Helvetica-Bold');
    sHdrs.forEach((h, i) =>
      doc.text(h, sCols[i] + 3, shdrY + 6, { width: sW[i] - 3 })
    );
    doc.y = shdrY + 18;

    locs.forEach((loc, idx) => {
      checkPageBreak(14);
      const rowY = doc.y;
      if (idx % 2 === 0) doc.rect(margin, rowY, inner, 14).fill(tmpl.tc.tableAlt);
      const area      = [loc.floor, loc.areaName].filter(Boolean).join(' – ') || '—';
      const modelStr  = loc.cameraModel
        ? [loc.cameraModel.manufacturer, loc.cameraModel.model].filter(Boolean).join(' ') || '—'
        : '—';
      const typeStr   = loc.cameraModel?.cameraType   || '—';
      const envStr    = loc.cameraModel?.indoorOutdoor || '—';
      const coverage  = loc.coveragePurpose || loc.mountingLocation || '—';
      const ry = rowY + 3;
      doc.fillColor(tmpl.tc.bodyText).fontSize(7.5).font('Helvetica');
      doc.text(area.substring(0, 28),        sCols[0] + 3, ry, { width: sW[0] - 3 });
      doc.text(modelStr.substring(0, 22),    sCols[1] + 3, ry, { width: sW[1] - 3 });
      doc.text(typeStr,                       sCols[2] + 3, ry, { width: sW[2] - 3 });
      doc.text(envStr,                        sCols[3] + 3, ry, { width: sW[3] - 3 });
      doc.text(coverage.substring(0, 14),    sCols[4] + 3, ry, { width: sW[4] - 3 });
      doc.y = rowY + 14;
    });

    // Total row
    checkPageBreak(16);
    const totY = doc.y;
    doc.rect(margin, totY, inner, 16).fill(tmpl.tc.subRow);
    doc.fillColor(tmpl.tc.subRowText).fontSize(8).font('Helvetica-Bold')
       .text(`Total camera locations surveyed: ${locs.length}`, margin + 6, totY + 4, { width: inner - 12 });
    doc.y = totY + 16;

    tmpl.pageFooter(doc, { pageW, margin, projectName: project.projectName, pageNum });
  }

  // ── Signatory section ───────────────────────────────────────────────────────
  newPage();
  tmpl.sectionHeading(doc, { margin, inner, label: 'Acceptance of Proposal' });
  doc.fillColor(tmpl.tc.bodyText).fontSize(9.5).font('Helvetica');
  doc.text(
    'The undersigned hereby accepts the terms, scope, and pricing outlined in this proposal and authorizes commencement of the described work.',
    margin, doc.y, { width: inner, align: 'justify', lineGap: 2 }
  );
  doc.moveDown(1.5);

  // Two-column signature blocks
  const sigColW = (inner - 40) / 2;
  const leftX   = margin;
  const rightX  = margin + sigColW + 40;
  const labels  = ['Authorized by (Client)', 'Authorized by (Vendor)'];
  const xPos    = [leftX, rightX];

  for (let col = 0; col < 2; col++) {
    const x = xPos[col];
    doc.fillColor(tmpl.tc.dimText ?? '#9CA3AF').fontSize(8).font('Helvetica-Bold')
       .text(labels[col], x, doc.y - (col === 1 ? doc.currentLineHeight() + 16 : 0), { width: sigColW });
  }
  doc.moveDown(0.3);

  const sigLineFields = ['Signature', 'Printed Name', 'Title', 'Date'];
  for (const fieldLabel of sigLineFields) {
    checkPageBreak(36);
    const y = doc.y;
    for (let col = 0; col < 2; col++) {
      const x = xPos[col];
      doc.moveTo(x, y + 20).lineTo(x + sigColW, y + 20)
         .strokeColor('#9CA3AF').lineWidth(0.5).stroke();
      doc.fillColor(tmpl.tc.dimText ?? '#9CA3AF').fontSize(7.5).font('Helvetica')
         .text(fieldLabel, x, y + 22, { width: sigColW });
    }
    doc.y = y + 36;
  }

  tmpl.pageFooter(doc, { pageW, margin, projectName: project.projectName, pageNum });

  // ── Appendix — hyperlinks ─────────────────────────────────────────────────────
  const linkedCosts = project.costs.filter(c => c.url?.trim());
  if (linkedCosts.length > 0) {
    newPage();
    tmpl.sectionHeading(doc, { margin, inner, label: 'Appendix A — Reference Links' });
    doc.fillColor(tmpl.tc.bodyText).fontSize(9.5).font('Helvetica');
    doc.text(
      'The following reference links are associated with line items in this proposal.',
      margin, doc.y, { width: inner, lineGap: 2 }
    );
    doc.moveDown(0.8);

    // Table header
    const aC = [margin, margin + 30, margin + 300];
    const aW = [28, 268, inner - 300];
    const hdrY = doc.y;
    doc.rect(margin, hdrY, inner, 16).fill(tmpl.tc.tableHdr);
    doc.fillColor(tmpl.tc.tableHdrText).fontSize(7.5).font('Helvetica-Bold');
    ['#', 'Description', 'URL'].forEach((h, i) =>
      doc.text(h, aC[i] + 3, hdrY + 5, { width: aW[i] - 3 })
    );
    doc.y = hdrY + 16;

    linkedCosts.forEach((c, idx) => {
      checkPageBreak(14);
      const rowY = doc.y;
      if (idx % 2 === 0) doc.rect(margin, rowY, inner, 14).fill(tmpl.tc.tableAlt ?? '#F9FAFB');
      const ry = rowY + 3;
      doc.fillColor(tmpl.tc.bodyText).fontSize(7.5).font('Helvetica')
         .text(String(idx + 1), aC[0] + 3, ry, { width: aW[0] - 3 });
      doc.text((c.description ?? '—').substring(0, 50), aC[1] + 3, ry, { width: aW[1] - 3 });
      doc.fillColor('#2563EB').fontSize(7.5)
         .text(c.url!, aC[2] + 3, ry, { width: aW[2] - 3, link: c.url!, underline: true });
      doc.y = rowY + 14;
    });

    tmpl.pageFooter(doc, { pageW, margin, projectName: project.projectName, pageNum });
  }

  doc.end();
  return finish;
}
