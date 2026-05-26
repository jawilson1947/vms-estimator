import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

const DARK_BLUE = 'FF1E3A5F';
const MID_BLUE  = 'FF2563EB';
const LIGHT_BLUE= 'FFE0ECFA';
const WHITE     = 'FFFFFFFF';
const ALT_ROW   = 'FFF0F4F8';

function hdrFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function currency(n: number | null | undefined) {
  if (n == null) return '';
  return Math.round(n * 100) / 100;
}

// GET /api/reports/costs.xlsx
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await prisma.project.findMany({
    include: {
      customer:   { select: { customerName: true } },
      costs:      { orderBy: [{ costCategory: 'asc' }, { id: 'asc' }] },
      feeSummary: true,
    },
    orderBy: { projectName: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CSMS';
  wb.created = new Date();

  // ─── Sheet 1: Portfolio Summary ───────────────────────────────────────────
  const portfolio = wb.addWorksheet('Portfolio Summary', {
    properties: { tabColor: { argb: DARK_BLUE } },
  });

  // Title
  portfolio.mergeCells('A1:G1');
  const t = portfolio.getCell('A1');
  t.value = 'Cost Estimator — Portfolio Summary';
  t.font  = { bold: true, size: 14, color: { argb: DARK_BLUE } };
  t.alignment = { horizontal: 'left', vertical: 'middle' };
  portfolio.getRow(1).height = 36;

  portfolio.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
  portfolio.getCell('A2').font  = { size: 9, italic: true, color: { argb: 'FF6B7280' } };

  // Header row
  const pHdr = portfolio.getRow(4);
  const pCols = ['Project', 'Customer', 'Status', 'Direct Costs', 'Overhead', 'Consulting', 'Grand Total'];
  pCols.forEach((h, i) => {
    const c = pHdr.getCell(i + 1);
    c.value = h;
    c.fill  = hdrFill(DARK_BLUE);
    c.font  = { bold: true, size: 10, color: { argb: WHITE } };
    c.alignment = { horizontal: i >= 3 ? 'right' : 'left', vertical: 'middle' };
  });
  pHdr.height = 24;

  const widths = [28, 22, 14, 16, 14, 14, 16];
  widths.forEach((w, i) => { portfolio.getColumn(i + 1).width = w; });

  let totalGrand = 0;
  let totalDirect = 0;

  projects.forEach((p, i) => {
    const row = portfolio.getRow(5 + i);
    const fs  = p.feeSummary;
    const direct = p.costs.reduce((s, c) => s + Number(c.lineTotal ?? 0), 0);
    const grand  = fs ? Number(fs.grandTotal) : direct;
    totalDirect += direct;
    totalGrand  += grand;

    const vals = [
      p.projectName,
      p.customer.customerName,
      p.projectStatus.replace('_', ' '),
      currency(direct),
      fs ? currency(Number(fs.overheadAmount)) : '',
      fs ? currency(Number(fs.consultingFee))  : '',
      currency(grand),
    ];
    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v as any;
      cell.font  = { size: 9 };
      cell.alignment = { horizontal: ci >= 3 ? 'right' : 'left', vertical: 'middle' };
      if (ci >= 3 && typeof v === 'number') {
        cell.numFmt = '$#,##0.00';
      }
      if (i % 2 === 0) cell.fill = hdrFill(ALT_ROW);
    });
  });

  // Totals row
  const totRow = portfolio.getRow(5 + projects.length + 1);
  totRow.getCell(1).value = 'TOTAL';
  totRow.getCell(1).font  = { bold: true, size: 10 };
  totRow.getCell(4).value = totalDirect;
  totRow.getCell(4).numFmt = '$#,##0.00';
  totRow.getCell(4).font   = { bold: true, size: 10 };
  totRow.getCell(7).value = totalGrand;
  totRow.getCell(7).numFmt = '$#,##0.00';
  totRow.getCell(7).font   = { bold: true, size: 10, color: { argb: MID_BLUE } };
  totRow.height = 22;
  for (let ci = 1; ci <= 7; ci++) {
    totRow.getCell(ci).border = { top: { style: 'double', color: { argb: DARK_BLUE } } };
  }

  portfolio.autoFilter = { from: 'A4', to: 'G4' };
  portfolio.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // ─── Per-project sheets ───────────────────────────────────────────────────
  for (const project of projects) {
    // Truncate sheet name to 31 chars (Excel limit)
    const sheetName = project.projectName.slice(0, 28);
    const ws = wb.addWorksheet(sheetName, {
      properties: { tabColor: { argb: MID_BLUE } },
    });

    // Title
    ws.mergeCells('A1:H1');
    const pt = ws.getCell('A1');
    pt.value = project.projectName;
    pt.font  = { bold: true, size: 13, color: { argb: DARK_BLUE } };
    pt.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(1).height = 32;

    ws.getCell('A2').value = `Customer: ${project.customer.customerName}`;
    ws.getCell('A2').font  = { size: 9, color: { argb: 'FF6B7280' } };
    ws.getCell('D2').value = `Status: ${project.projectStatus.replace('_', ' ')}`;
    ws.getCell('D2').font  = { size: 9, color: { argb: 'FF6B7280' } };

    // ── Line items ──
    const lineCols = [
      { header: 'Category',     key: 'category',  width: 22 },
      { header: 'Description',  key: 'desc',      width: 32 },
      { header: 'Vendor',       key: 'vendor',    width: 18 },
      { header: 'Qty',          key: 'qty',       width: 7  },
      { header: 'Unit Cost',    key: 'unitCost',  width: 13 },
      { header: 'Markup %',     key: 'markup',    width: 10 },
      { header: 'Line Total',   key: 'total',     width: 14 },
      { header: 'Billable',     key: 'billable',  width: 9  },
    ];
    ws.columns = lineCols;

    const lhdr = ws.getRow(4);
    lineCols.forEach((col, ci) => {
      const cell = lhdr.getCell(ci + 1);
      cell.value = col.header;
      cell.fill  = hdrFill(DARK_BLUE);
      cell.font  = { bold: true, size: 10, color: { argb: WHITE } };
      cell.alignment = { horizontal: ci >= 3 ? 'right' : 'left', vertical: 'middle' };
    });
    lhdr.height = 24;

    project.costs.forEach((c, i) => {
      const row = ws.getRow(5 + i);
      const vals: any[] = [
        c.costCategory.replace('_', ' '),
        c.description ?? '',
        c.vendor ?? '',
        Number(c.quantity),
        Number(c.unitCost),
        Number(c.markupPercent),
        Number(c.lineTotal ?? 0),
        c.billable ? 'Yes' : 'No',
      ];
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.font  = { size: 9 };
        cell.alignment = { horizontal: ci >= 3 ? 'right' : 'left', vertical: 'middle' };
        if (ci === 4 || ci === 6) cell.numFmt = '$#,##0.00';
        if (ci === 5) cell.numFmt = '0.0"%"';
        if (i % 2 === 0) cell.fill = hdrFill(ALT_ROW);
      });
    });

    const directTotal = project.costs.reduce((s, c) => s + Number(c.lineTotal ?? 0), 0);
    const fs = project.feeSummary;

    // ── Fee Summary block ──
    let sr = 5 + project.costs.length + 2;

    ws.mergeCells(`A${sr}:C${sr}`);
    ws.getCell(`A${sr}`).value = 'Fee Summary';
    ws.getCell(`A${sr}`).font  = { bold: true, size: 11, color: { argb: WHITE } };
    ws.getCell(`A${sr}`).fill  = hdrFill(DARK_BLUE);
    ws.getCell(`A${sr}`).alignment = { indent: 1, vertical: 'middle' };
    ws.getRow(sr).height = 22;
    sr++;

    const feeLines: [string, number][] = [
      ['Direct Cost Total', directTotal],
      ['Overhead', fs ? Number(fs.overheadAmount) : 0],
      ['Consulting Fee', fs ? Number(fs.consultingFee) : 0],
      ['Project Management Fee', fs ? Number(fs.projectManagementFee) : 0],
      ['Contingency', fs ? Number(fs.contingencyAmount) : 0],
      ['Tax', fs ? Number(fs.taxAmount) : 0],
    ];
    for (const [label, val] of feeLines) {
      ws.getCell(`A${sr}`).value = label;
      ws.getCell(`A${sr}`).font  = { size: 9, color: { argb: 'FF374151' } };
      ws.getCell(`B${sr}`).value = val;
      ws.getCell(`B${sr}`).font  = { size: 9 };
      ws.getCell(`B${sr}`).numFmt = '$#,##0.00';
      ws.getCell(`B${sr}`).alignment = { horizontal: 'right' };
      sr++;
    }

    // Grand total
    ws.getCell(`A${sr}`).value = 'Grand Total';
    ws.getCell(`A${sr}`).font  = { bold: true, size: 10, color: { argb: DARK_BLUE } };
    ws.getCell(`B${sr}`).value = fs ? Number(fs.grandTotal) : directTotal;
    ws.getCell(`B${sr}`).numFmt = '$#,##0.00';
    ws.getCell(`B${sr}`).font   = { bold: true, size: 10, color: { argb: MID_BLUE } };
    ws.getCell(`B${sr}`).alignment = { horizontal: 'right' };
    ws.getCell(`A${sr}`).border = { top: { style: 'double', color: { argb: DARK_BLUE } } };
    ws.getCell(`B${sr}`).border = { top: { style: 'double', color: { argb: DARK_BLUE } } };

    ws.autoFilter = { from: 'A4', to: 'H4' };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
  }

  // ─── Serialize ────────────────────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cost-breakdown-${date}.xlsx"`,
    },
  });
}
