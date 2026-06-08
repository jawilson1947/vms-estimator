/**
 * Shared PDF generation logic for proposal documents.
 * Used by both the saved-proposal export route and the stateless preview route.
 */
import PDFDocument from 'pdfkit';
import { getTemplate } from '@/lib/pdf-templates';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProposalCompanyInfo {
  companyName?:    string | null;
  companyTagline?: string | null;
  companyAddress?: string | null;
  companyPhone?:   string | null;
  companyWebsite?: string | null;
  logoUrl?:        string | null;
}

export interface ProposalProjectData {
  projectName:    string;
  projectNumber?: string | null;
  projectManager?: string | null;
  customer: { customerName: string };
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
    description?: string | null;
    quantity:     number | string | { toString(): string };
    unitCost:     number | string | { toString(): string };
    lineTotal?:   number | string | { toString(): string } | null;
    url?:         string | null;
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
  costBreakdown:      'Investment Summary',
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
    companyName:     company.companyName,
    companyTagline:  company.companyTagline,
    companyAddress:  company.companyAddress,
    companyPhone:    company.companyPhone,
    companyWebsite:  company.companyWebsite,
  });
  tmpl.pageFooter(doc, { pageW, margin, projectName: project.projectName, pageNum });

  // ── Content sections ────────────────────────────────────────────────────────
  // Track whether we've rendered the cost table so we don't double-render
  let costTableRendered = false;

  for (const key of SECTION_ORDER) {
    const text = content[key];
    // For costBreakdown: render even when text is empty as long as costs exist
    const hasCosts = key === 'costBreakdown' && project.costs.length > 0;
    if ((!text || text.trim() === '') && !hasCosts) continue;

    newPage();
    tmpl.sectionHeading(doc, { margin, inner, label: SECTION_LABELS[key] });
    if (text && text.trim()) drawParagraphs(text);

    // ── Cost table ────────────────────────────────────────────────────────────
    if (key === 'costBreakdown' && project.costs.length > 0 && !costTableRendered) {
      costTableRendered = true;
      checkPageBreak(120);
      doc.moveDown(0.5);

      // Group by category (already sorted by category.sortOrder from query)
      const grouped = new Map<string, typeof project.costs>();
      for (const c of project.costs) {
        const catKey = c.category.name;
        if (!grouped.has(catKey)) grouped.set(catKey, []);
        grouped.get(catKey)!.push(c);
      }

      // Column layout
      const tCols = [margin, margin + 290, margin + 350, margin + 430];
      const tW    = [287, 57, 77, 79];
      const tHdrs = ['Description', 'Qty', 'Unit Cost', 'Line Total'];

      // Header row
      const hdrY = doc.y;
      doc.rect(margin, hdrY, inner, 18).fill(tmpl.tc.tableHdr);
      doc.fillColor(tmpl.tc.tableHdrText).fontSize(7.5).font('Helvetica-Bold');
      tHdrs.forEach((h, i) =>
        doc.text(h, tCols[i] + 3, hdrY + 6, { width: tW[i], align: i >= 1 ? 'right' : 'left' }),
      );
      doc.y = hdrY + 18;

      let rowIdx = 0;
      for (const [catName, items] of grouped) {
        // Category header
        checkPageBreak(32);
        const catY = doc.y;
        doc.rect(margin, catY, inner, 16).fill(tmpl.tc.catRow);
        doc.fillColor(tmpl.tc.catRowText).fontSize(8).font('Helvetica-Bold')
           .text(catName, margin + 6, catY + 4, { width: inner - 12 });
        doc.y = catY + 16;

        const catSubtotal = items.reduce((sum, c) => sum + n(c.lineTotal), 0);

        for (const c of items) {
          checkPageBreak(15);
          const itemY = doc.y;
          if (rowIdx % 2 === 0) doc.rect(margin, itemY, inner, 15).fill(tmpl.tc.tableAlt);
          const ry = itemY + 4;
          doc.fillColor(tmpl.tc.bodyText).fontSize(7.5).font('Helvetica')
             .text((c.description ?? '').substring(0, 55), tCols[0] + 3, ry, { width: tW[0] - 3 });
          doc.text(String(n(c.quantity)),  tCols[1] + 3, ry, { width: tW[1] - 3, align: 'right' });
          doc.text(fmt(n(c.unitCost)),     tCols[2] + 3, ry, { width: tW[2] - 3, align: 'right' });
          doc.text(fmt(n(c.lineTotal)),    tCols[3] + 3, ry, { width: tW[3] - 3, align: 'right' });
          doc.y = itemY + 15;
          rowIdx++;
        }

        // Subtotal row
        checkPageBreak(16);
        const subY = doc.y;
        doc.rect(margin, subY, inner, 16).fill(tmpl.tc.subRow);
        doc.fillColor(tmpl.tc.subRowText).fontSize(8).font('Helvetica-Bold')
           .text('Subtotal', tCols[0] + 3, subY + 4, { width: tW[0] + tW[1] + tW[2] - 6, align: 'right' });
        doc.fillColor(tmpl.tc.subRowText)
           .text(fmt(catSubtotal), tCols[3] + 3, subY + 4, { width: tW[3] - 3, align: 'right' });
        doc.y = subY + 16;
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

        doc.moveDown(0.5);
        doc.moveTo(margin, doc.y).lineTo(margin + inner, doc.y)
           .strokeColor('#E5E7EB').lineWidth(0.5).stroke();
        doc.moveDown(0.3);

        for (const [label, val] of feeRows) {
          checkPageBreak(14);
          const feeY = doc.y;
          doc.fillColor(tmpl.tc.dimText).fontSize(8).font('Helvetica')
             .text(label, margin + inner - 180, feeY, { width: 130, align: 'right' });
          doc.fillColor(tmpl.tc.bodyText)
          doc.y = feeY + doc.currentLineHeight() + 3;
        }

        // Grand total bar
        checkPageBreak(28);
        const gtY = doc.y + 4;
        doc.rect(margin + inner - 230, gtY, 230, 24).fill(tmpl.tc.totalBar);
        doc.fillColor(tmpl.tc.totalText).fontSize(9).font('Helvetica-Bold')
           .text('GRAND TOTAL', margin + inner - 112, gtY + 6, { width: 108, align: 'right' });
        doc.y = gtY + 30;
      }
    }

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
