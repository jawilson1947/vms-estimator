import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

const DARK_BLUE  = 'FF1E3A5F';
const MID_BLUE   = 'FF2563EB';
const LIGHT_GREEN= 'FFdcfce7';
const WHITE      = 'FFFFFFFF';
const ALT_ROW    = 'FFF0F4F8';

function hdrFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function currency(n: number | null | undefined) {
  if (n == null) return '';
  return Math.round(n * 100) / 100;
}

function buildSurveyGroups(
  cameraLocations: Array<Record<string, unknown>>,
  markupByModel:   Map<number, number>,
) {
  const groupMap = new Map<number, {
    description: string; quantity: number; unitCost: number; markup: number;
  }>();
  for (const loc of cameraLocations) {
    const modelId = loc.cameraModelId as number | null;
    const model   = loc.cameraModel   as Record<string, unknown> | null;
    if (!modelId || !model?.cost) continue;
    const unitCost = Number(model.cost);
    if (unitCost <= 0) continue;
    const description = [model.manufacturer, model.model].filter(Boolean).join(' ') || 'Unspecified Camera';
    const markup = markupByModel.get(modelId) ?? 0;
    const entry = groupMap.get(modelId);
    if (entry) { entry.quantity += 1; }
    else        { groupMap.set(modelId, { description, quantity: 1, unitCost, markup }); }
  }
  let surveyTotal = 0;
  const groups = Array.from(groupMap.values()).map(g => {
    const displayUnit = g.unitCost * (1 + g.markup / 100);
    const lineTotal   = displayUnit * g.quantity;
    surveyTotal += lineTotal;
    return { ...g, displayUnit, lineTotal };
  });
  return { groups, surveyTotal };
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await prisma.project.findMany({
    include: {
      customer:   { select: { customerName: true } },
      costs:      { orderBy: [{ category: { sortOrder: 'asc' } }, { id: 'asc' }], include: { category: true } },
      cameraLocations: {
        orderBy: [{ floor: 'asc' }, { areaName: 'asc' }],
        select: {
          cameraModelId: true,
          cameraModel: { select: { manufacturer: true, model: true, cost: true } },
        },
      },
      feeSummary: true,
    },
    orderBy: { projectName: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CSMS';
  wb.created = new Date();

  const portfolio = wb.addWorksheet('Portfolio Summary', {
    properties: { tabColor: { argb: DARK_BLUE } },
  });

  portfolio.mergeCells('A1:G1');
  const t = portfolio.getCell('A1');
  t.value = 'Cost Estimator -- Portfolio Summary';
  t.font  = { bold: true, size: 14, color: { argb: DARK_BLUE } };
  t.alignment = { horizontal: 'left', vertical: 'middle' };
  portfolio.getRow(1).height = 36;
  portfolio.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
  portfolio.getCell('A2').font  = { size: 9, italic: true, color: { argb: 'FF6B7280' } };

  const pHdr = portfolio.getRow(4);
  ['Project', 'Customer', 'Status', 'Direct Costs', 'Overhead', 'Consulting', 'Grand Total'].forEach((h, i) => {
    const c = pHdr.getCell(i + 1);
    c.value = h;
    c.fill  = hdrFill(DARK_BLUE);
    c.font  = { bold: true, size: 10, color: { argb: WHITE } };
    c.alignment = { horizontal: i >= 3 ? 'right' : 'left', vertical: 'middle' };
  });
  pHdr.height = 24;
  [28, 22, 14, 16, 14, 14, 16].forEach((w, i) => { portfolio.getColumn(i + 1).width = w; });

  let totalGrand = 0;
  let totalDirect = 0;

  projects.forEach((p, i) => {
    const row = portfolio.getRow(5 + i);
    const fs  = p.feeSummary;
    const markupByModel = new Map<number, number>();
    for (const c of p.costs) {
      if (c.surveyLocationId != null && c.cameraModelId != null) {
        markupByModel.set(c.cameraModelId, Number(c.markupPercent ?? 0));
      }
    }
    const { surveyTotal } = buildSurveyGroups(
      p.cameraLocations as unknown as Array<Record<string, unknown>>,
      markupByModel,
    );
    const manualTotal = p.costs.filter(c => c.surveyLocationId == null).reduce((s, c) => s + Number(c.lineTotal ?? 0), 0);
    const direct = surveyTotal + manualTotal;
    const overheadPct = fs ? Number(fs.overheadPercent ?? 0) : 0;
    const grand = direct * (1 + overheadPct / 100)
      + (fs ? Number(fs.consultingFee ?? 0) : 0)
      + (fs ? Number(fs.projectManagementFee ?? 0) : 0)
      + (fs ? Number(fs.contingencyAmount ?? 0) : 0)
      + (fs ? Number(fs.taxAmount ?? 0) : 0);
    totalDirect += direct;
    totalGrand  += grand;

    [
      p.projectName,
      p.customer.customerName,
      p.projectStatus.replace('_', ' '),
      currency(direct),
      fs ? currency(direct * (overheadPct / 100)) : '',
      fs ? currency(Number(fs.consultingFee)) : '',
      currency(grand),
    ].forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font  = { size: 9 };
      cell.alignment = { horizontal: ci >= 3 ? 'right' : 'left', vertical: 'middle' };
      if (ci >= 3 && typeof v === 'number') cell.numFmt = '$#,##0.00';
      if (i % 2 === 0) cell.fill = hdrFill(ALT_ROW);
    });
  });

  const totRow = portfolio.getRow(5 + projects.length + 1);
  totRow.getCell(1).value = 'TOTAL';
  totRow.getCell(1).font  = { bold: true, size: 10 };
  totRow.getCell(4).value = totalDirect;  totRow.getCell(4).numFmt = '$#,##0.00'; totRow.getCell(4).font = { bold: true, size: 10 };
  totRow.getCell(7).value = totalGrand;   totRow.getCell(7).numFmt = '$#,##0.00'; totRow.getCell(7).font = { bold: true, size: 10, color: { argb: MID_BLUE } };
  totRow.height = 22;
  for (let ci = 1; ci <= 7; ci++) {
    totRow.getCell(ci).border = { top: { style: 'double', color: { argb: DARK_BLUE } } };
  }
  portfolio.autoFilter = { from: 'A4', to: 'G4' };
  portfolio.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  for (const project of projects) {
    const ws = wb.addWorksheet(project.projectName.slice(0, 28), {
      properties: { tabColor: { argb: MID_BLUE } },
    });

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

    const lineCols = [
      { header: 'Category',    key: 'category', width: 22 },
      { header: 'Description', key: 'desc',     width: 32 },
      { header: 'Vendor',      key: 'vendor',   width: 18 },
      { header: 'Qty',         key: 'qty',      width: 7  },
      { header: 'Unit Cost',   key: 'unitCost', width: 13 },
      { header: 'Markup %',    key: 'markup',   width: 10 },
      { header: 'Line Total',  key: 'total',    width: 14 },
      { header: 'Billable',    key: 'billable', width: 9  },
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

    let rowIdx = 5;
    let rowCount = 0;

    const markupByModel = new Map<number, number>();
    for (const c of project.costs) {
      if (c.surveyLocationId != null && c.cameraModelId != null) {
        markupByModel.set(c.cameraModelId, Number(c.markupPercent ?? 0));
      }
    }
    const { groups: surveyGroups, surveyTotal } = buildSurveyGroups(
      project.cameraLocations as unknown as Array<Record<string, unknown>>,
      markupByModel,
    );

    for (const g of surveyGroups) {
      const row = ws.getRow(rowIdx);
      const vals: ExcelJS.CellValue[] = ['Survey Cameras', g.description, '', g.quantity, g.displayUnit, g.markup, g.lineTotal, 'Yes'];
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.font  = { size: 9 };
        cell.alignment = { horizontal: ci >= 3 ? 'right' : 'left', vertical: 'middle' };
        if (ci === 4 || ci === 6) cell.numFmt = '$#,##0.00';
        if (ci === 5) cell.numFmt = '0.0"%"';
        cell.fill = hdrFill(rowCount % 2 === 0 ? LIGHT_GREEN : ALT_ROW);
      });
      rowIdx++; rowCount++;
    }

    // Quantity-0 rows are "removed BOM item" markers — never real cost lines
    const manualCosts = project.costs.filter(c => c.surveyLocationId == null && Number(c.quantity) > 0);
    let manualTotal = 0;
    manualCosts.forEach(c => {
      const row      = ws.getRow(rowIdx);
      const unitCost = Number(c.unitCost);
      const total    = Number(c.lineTotal ?? 0);
      manualTotal   += total;
      const vals: ExcelJS.CellValue[] = [c.category.name, c.description ?? '', c.vendor ?? '', Number(c.quantity), unitCost !== total ? total : unitCost, Number(c.markupPercent), total, c.billable ? 'Yes' : 'No'];
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.font  = { size: 9 };
        cell.alignment = { horizontal: ci >= 3 ? 'right' : 'left', vertical: 'middle' };
        if (ci === 4 || ci === 6) cell.numFmt = '$#,##0.00';
        if (ci === 5) cell.numFmt = '0.0"%"';
        if (rowCount % 2 === 0) cell.fill = hdrFill(ALT_ROW);
      });
      rowIdx++; rowCount++;
    });

    const directTotal   = surveyTotal + manualTotal;
    const fs = project.feeSummary;
    const overheadPct   = fs ? Number(fs.overheadPercent      ?? 0) : 0;
    const overheadAmt   = directTotal * (overheadPct / 100);
    const consultingFee = fs ? Number(fs.consultingFee        ?? 0) : 0;
    const pmFee         = fs ? Number(fs.projectManagementFee ?? 0) : 0;
    const contingency   = fs ? Number(fs.contingencyAmount    ?? 0) : 0;
    const tax           = fs ? Number(fs.taxAmount            ?? 0) : 0;
    const grandTotal    = directTotal + overheadAmt + consultingFee + pmFee + contingency + tax;

    let sr = rowIdx + 2;
    ws.mergeCells(`A${sr}:C${sr}`);
    ws.getCell(`A${sr}`).value = 'Fee Summary';
    ws.getCell(`A${sr}`).font  = { bold: true, size: 11, color: { argb: WHITE } };
    ws.getCell(`A${sr}`).fill  = hdrFill(DARK_BLUE);
    ws.getCell(`A${sr}`).alignment = { indent: 1, vertical: 'middle' };
    ws.getRow(sr).height = 22;
    sr++;

    for (const [label, val] of [
      ['Direct Cost Total', directTotal],
      [`Overhead (${overheadPct.toFixed(1)}%)`, overheadAmt],
      ['Consulting Fee', consultingFee],
      ['Project Management Fee', pmFee],
      ['Contingency', contingency],
      ['Tax', tax],
    ] as [string, number][]) {
      ws.getCell(`A${sr}`).value = label;
      ws.getCell(`A${sr}`).font  = { size: 9, color: { argb: 'FF374151' } };
      ws.getCell(`B${sr}`).value = val;
      ws.getCell(`B${sr}`).font  = { size: 9 };
      ws.getCell(`B${sr}`).numFmt = '$#,##0.00';
      ws.getCell(`B${sr}`).alignment = { horizontal: 'right' };
      sr++;
    }

    ws.getCell(`A${sr}`).value = 'Grand Total';
    ws.getCell(`A${sr}`).font  = { bold: true, size: 10, color: { argb: DARK_BLUE } };
    ws.getCell(`B${sr}`).value = grandTotal;
    ws.getCell(`B${sr}`).numFmt = '$#,##0.00';
    ws.getCell(`B${sr}`).font   = { bold: true, size: 10, color: { argb: MID_BLUE } };
    ws.getCell(`B${sr}`).alignment = { horizontal: 'right' };
    ws.getCell(`A${sr}`).border = { top: { style: 'double', color: { argb: DARK_BLUE } } };
    ws.getCell(`B${sr}`).border = { top: { style: 'double', color: { argb: DARK_BLUE } } };

    ws.autoFilter = { from: 'A4', to: 'H4' };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
  }

  const buf  = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cost-breakdown-${date}.xlsx"`,
    },
  });
}
