import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PDFDocument from 'pdfkit';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';

// ─── Colors ───────────────────────────────────────────────────────────────────
const NAVY  = '#1E3A5F';
const BLUE  = '#2563EB';
const GRAY  = '#6B7280';
const LGRAY = '#F3F4F6';
const WHITE = '#FFFFFF';
const BLACK = '#111827';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

const SECTION_LABELS: Record<keyof ProposalContent, string> = {
  coverLetter:        'Cover Letter',
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

function drawHeader(doc: PDFKit.PDFDocument, pageW: number, margin: number, date: string) {
  doc.rect(0, 0, pageW, 72).fill(NAVY);
  doc.fillColor(WHITE).fontSize(18).font('Helvetica-Bold')
     .text('CSMS', margin, 20);
  doc.fillColor('#93C5FD').fontSize(9).font('Helvetica')
     .text('Camera & Security Management Systems', margin, 40);
  doc.fillColor('#CBD5E1').fontSize(9)
     .text(date, pageW - margin - 120, 40, { width: 120, align: 'right' });
}

function drawFooter(doc: PDFKit.PDFDocument, pageW: number, margin: number, projectName: string, pageNum: number) {
  const y = doc.page.height - 36;
  doc.moveTo(margin, y).lineTo(pageW - margin, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  doc.fillColor(GRAY).fontSize(8).font('Helvetica')
     .text(`${projectName} — Confidential`, margin, y + 8)
     .text(`Page ${pageNum}`, margin, y + 8, { width: pageW - margin * 2, align: 'right' });
}

function drawSectionHeading(doc: PDFKit.PDFDocument, margin: number, inner: number, label: string) {
  doc.rect(margin, doc.y, inner, 24).fill(LGRAY);
  doc.fillColor(NAVY).fontSize(11).font('Helvetica-Bold')
     .text(label, margin + 8, doc.y - 24 + 7);
  doc.moveDown(0.6);
}

function drawParagraphs(doc: PDFKit.PDFDocument, margin: number, inner: number, text: string) {
  const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  doc.fillColor(BLACK).fontSize(9.5).font('Helvetica');
  for (const para of paras) {
    doc.text(para, margin, doc.y, { width: inner, align: 'justify', lineGap: 2 });
    doc.moveDown(0.7);
  }
}

// POST /api/projects/[id]/proposals/[proposalId]/pdf
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, proposalId } = await params;

  const [proposal, project] = await Promise.all([
    prisma.proposal.findUnique({ where: { id: Number(proposalId) } }),
    prisma.project.findUnique({
      where:   { id: Number(id) },
      include: {
        customer:   { select: { customerName: true } },
        feeSummary: true,
        costs:      { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
      },
    }),
  ]);

  if (!proposal || !project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const content = proposal.content as unknown as ProposalContent;
  const doc = new PDFDocument({ margin: 50, size: 'LETTER', autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finish = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const pageW  = 612; // LETTER
  const margin = 50;
  const inner  = pageW - margin * 2;
  const date   = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  let pageNum  = 0;

  function newPage() {
    pageNum++;
    doc.addPage();
    drawHeader(doc, pageW, margin, date);
    doc.y = 90;
  }

  function checkPageBreak(needed = 80) {
    if (doc.y + needed > doc.page.height - 60) {
      drawFooter(doc, pageW, margin, project!.projectName, pageNum);
      newPage();
    }
  }

  // ── Cover page ────────────────────────────────────────────────────────────
  pageNum++;
  doc.addPage();
  doc.rect(0, 0, pageW, doc.page.height).fill(NAVY);

  const coverY = 160;
  doc.fillColor(WHITE).fontSize(28).font('Helvetica-Bold')
     .text('PROPOSAL', margin, coverY, { width: inner });
  doc.fillColor('#93C5FD').fontSize(16).font('Helvetica')
     .text(project.projectName, margin, coverY + 44, { width: inner });
  doc.fillColor('#CBD5E1').fontSize(11)
     .text(project.customer.customerName, margin, coverY + 72, { width: inner });

  // Details box
  const boxY = coverY + 120;
  doc.rect(margin, boxY, inner, 130).fillAndStroke('#FFFFFF11', '#FFFFFF33');
  const details: [string, string][] = [
    ['Prepared For',   project.customer.customerName],
    ['Project',        project.projectName + (project.projectNumber ? `  (${project.projectNumber})` : '')],
    ['Project Manager',project.projectManager || '—'],
    ['Date',           date],
    ['Valid Until',    proposal.validUntil
      ? new Date(proposal.validUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '30 days from date of issue'],
  ];
  details.forEach(([label, value], i) => {
    const ry = boxY + 14 + i * 22;
    doc.fillColor('#93C5FD').fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), margin + 16, ry);
    doc.fillColor(WHITE).fontSize(9).font('Helvetica').text(value, margin + 130, ry, { width: inner - 146 });
  });

  // Grand total callout
  if (project.feeSummary) {
    const totalY = boxY + 160;
    doc.rect(margin, totalY, inner, 48).fill('#2563EB');
    doc.fillColor(WHITE).fontSize(10).font('Helvetica').text('INVESTMENT TOTAL', margin + 16, totalY + 9, { width: inner - 32 });
    doc.fillColor(WHITE).fontSize(22).font('Helvetica-Bold')
       .text(fmt(Number(project.feeSummary.grandTotal)), margin + 16, totalY + 22, { width: inner - 32 });
  }

  drawFooter(doc, pageW, margin, project.projectName, pageNum);

  // ── Content sections ──────────────────────────────────────────────────────
  for (const key of SECTION_ORDER) {
    const text = content[key];
    if (!text || text.trim() === '') continue;

    newPage();
    drawSectionHeading(doc, margin, inner, SECTION_LABELS[key]);
    drawParagraphs(doc, margin, inner, text);

    // After costBreakdown prose, append the actual cost table
    if (key === 'costBreakdown' && project.feeSummary) {
      checkPageBreak(120);
      doc.moveDown(0.5);

      // Table header
      const tCols = [margin, margin + 140, margin + 260, margin + 340, margin + 420];
      const tW    = [130, 110, 70, 70, 80];
      const tHdrs = ['Category', 'Description', 'Qty', 'Unit Cost', 'Line Total'];

      doc.rect(margin, doc.y, inner, 18).fill(NAVY);
      doc.fillColor(WHITE).fontSize(7.5).font('Helvetica-Bold');
      tHdrs.forEach((h, i) => doc.text(h, tCols[i] + 3, doc.y - 18 + 6, { width: tW[i], align: i >= 2 ? 'right' : 'left' }));

      doc.fillColor(BLACK).fontSize(7.5).font('Helvetica');
      let rowIdx = 0;
      for (const c of project.costs) {
        checkPageBreak(16);
        if (rowIdx % 2 === 0) doc.rect(margin, doc.y, inner, 15).fill('#F9FAFB');
        const ry = doc.y + 4;
        doc.fillColor(GRAY).text(c.category.name, tCols[0] + 3, ry, { width: tW[0] - 3 });
        doc.fillColor(BLACK).text((c.description ?? '').substring(0, 28), tCols[1] + 3, ry, { width: tW[1] - 3 });
        doc.text(String(Number(c.quantity)),    tCols[2] + 3, ry, { width: tW[2] - 3, align: 'right' });
        doc.text(fmt(Number(c.unitCost)),        tCols[3] + 3, ry, { width: tW[3] - 3, align: 'right' });
        doc.text(fmt(Number(c.lineTotal ?? 0)), tCols[4] + 3, ry, { width: tW[4] - 3, align: 'right' });
        doc.y += 15;
        rowIdx++;
      }

      // Fee summary footer
      const fs = project.feeSummary;
      const feeRows: [string, number][] = [
        ['Direct Cost Total',    Number(fs.directCostTotal)],
        [`Overhead (${Number(fs.overheadPercent).toFixed(1)}%)`, Number(fs.overheadAmount)],
        ['Consulting Fee',       Number(fs.consultingFee)],
        ['Project Management Fee', Number(fs.projectManagementFee)],
        ['Contingency',          Number(fs.contingencyAmount)],
        ['Tax',                  Number(fs.taxAmount)],
      ].filter(([, v]) => (v as number) > 0) as [string, number][];

      doc.moveTo(margin, doc.y).lineTo(margin + inner, doc.y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      for (const [label, val] of feeRows) {
        checkPageBreak(14);
        doc.fillColor(GRAY).fontSize(8).font('Helvetica')
           .text(label, margin + inner - 180, doc.y, { width: 130, align: 'right' });
        doc.fillColor(BLACK)
           .text(fmt(val), margin + inner - 46, doc.y - doc.currentLineHeight(), { width: 46, align: 'right' });
        doc.moveDown(0.35);
      }

      // Grand total
      checkPageBreak(24);
      doc.rect(margin + inner - 230, doc.y, 230, 22).fill(BLUE);
      doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
         .text('GRAND TOTAL', margin + inner - 226, doc.y - 22 + 7, { width: 110 });
      doc.fillColor(WHITE).fontSize(11)
         .text(fmt(Number(fs.grandTotal)), margin + inner - 112, doc.y - 22 + 5, { width: 108, align: 'right' });
      doc.y += 6;
    }

    drawFooter(doc, pageW, margin, project.projectName, pageNum);
  }

  doc.end();
  const buf = await finish;

  const slug = project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="proposal-${slug}-${dateStr}.pdf"`,
    },
  });
}
