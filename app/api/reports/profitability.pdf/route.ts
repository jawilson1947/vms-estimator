import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PDFDocument from 'pdfkit';

const NAVY  = '#1E3A5F';
const BLUE  = '#2563EB';
const GREEN = '#16A34A';
const RED   = '#DC2626';
const GRAY  = '#6B7280';
const LGRAY = '#F3F4F6';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number) {
  return n.toFixed(1) + '%';
}

// GET /api/reports/profitability.pdf
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await prisma.project.findMany({
    include: {
      customer: { select: { customerName: true } },
      feeSummary: true,
      costs: { select: { unitCost: true, quantity: true } },
    },
    orderBy: { projectName: 'asc' },
  });

  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const finish = new Promise<Buffer>(resolve =>
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  );

  const pageW  = doc.page.width;
  const margin = 50;
  const inner  = pageW - margin * 2;
  const date   = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Header ────────────────────────────────────────────────────────────────
  doc.rect(0, 0, pageW, 72).fill(NAVY);
  doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
     .text('Project Profitability Summary', margin, 22);
  doc.fillColor('#CBD5E1').fontSize(9).font('Helvetica')
     .text(`Generated ${date}`, margin, 48);
  doc.moveDown(3);

  // ── Portfolio totals ──────────────────────────────────────────────────────
  let totalDirectCost = 0;
  let totalGrand      = 0;
  for (const p of projects) {
    const dc = Number(p.feeSummary?.directCostTotal ?? 0);
    const gt = Number(p.feeSummary?.grandTotal      ?? 0);
    totalDirectCost += dc;
    totalGrand      += gt;
  }
  const portfolioMargin = totalGrand > 0 ? ((totalGrand - totalDirectCost) / totalGrand) * 100 : 0;

  let y = doc.y + 10;

  // Summary row
  const boxW = (inner - 12) / 3;
  const boxes = [
    { label: 'Total Revenue',   val: fmt(totalGrand),                   color: NAVY  },
    { label: 'Total Direct Cost',val: fmt(totalDirectCost),             color: GRAY  },
    { label: 'Portfolio Margin', val: pct(portfolioMargin),             color: portfolioMargin >= 20 ? GREEN : RED },
  ];
  for (let i = 0; i < 3; i++) {
    const bx = margin + i * (boxW + 6);
    doc.rect(bx, y, boxW, 52).fill(LGRAY);
    doc.fillColor(boxes[i].color).fontSize(14).font('Helvetica-Bold')
       .text(boxes[i].val, bx + 8, y + 10, { width: boxW - 16, align: 'center' });
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text(boxes[i].label, bx + 8, y + 32, { width: boxW - 16, align: 'center' });
  }

  y += 68;
  doc.moveTo(margin, y).lineTo(margin + inner, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
  y += 14;

  // ── Per-project table ─────────────────────────────────────────────────────
  const colX  = [margin, margin + 160, margin + 290, margin + 380, margin + 460];
  const colW  = [150,    120,           80,           70,           70           ];
  const hdrs  = ['Project', 'Customer', 'Revenue', 'Direct Cost', 'Margin'];

  // Table header
  doc.rect(margin, y, inner, 20).fill(NAVY);
  doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
  hdrs.forEach((h, i) => doc.text(h, colX[i] + 4, y + 6, { width: colW[i], align: i >= 2 ? 'right' : 'left' }));
  y += 20;

  doc.fillColor('#111827').fontSize(8).font('Helvetica');
  let rowIdx = 0;
  for (const p of projects) {
    const dc = Number(p.feeSummary?.directCostTotal ?? 0);
    const gt = Number(p.feeSummary?.grandTotal ?? 0);
    const mg = gt > 0 ? ((gt - dc) / gt) * 100 : 0;

    if (rowIdx % 2 === 0) doc.rect(margin, y, inner, 18).fill('#F9FAFB');
    doc.fillColor(GRAY);

    const rowH = 18;
    doc.fillColor('#111827').text(p.projectName.substring(0, 22), colX[0] + 4, y + 5, { width: colW[0] - 4 });
    doc.fillColor(GRAY)     .text((p.customer?.customerName ?? '').substring(0, 18), colX[1] + 4, y + 5, { width: colW[1] - 4 });
    doc.fillColor('#111827').text(fmt(gt), colX[2] + 4, y + 5, { width: colW[2] - 4, align: 'right' });
    doc.fillColor('#111827').text(fmt(dc), colX[3] + 4, y + 5, { width: colW[3] - 4, align: 'right' });
    doc.fillColor(mg >= 20 ? GREEN : mg >= 10 ? '#D97706' : RED)
       .font('Helvetica-Bold').text(pct(mg), colX[4] + 4, y + 5, { width: colW[4] - 4, align: 'right' });
    doc.font('Helvetica');

    y += rowH;
    rowIdx++;

    // Page break
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
  }

  // Footer
  const footerY = doc.page.height - 36;
  doc.moveTo(margin, footerY).lineTo(margin + inner, footerY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  doc.fillColor(GRAY).fontSize(8).font('Helvetica')
     .text('CSMS — Confidential', margin, footerY + 8)
     .text(date, margin, footerY + 8, { width: inner, align: 'right' });

  doc.end();
  const buf = await finish;

  const dateStr = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="profitability-${dateStr}.pdf"`,
    },
  });
}
