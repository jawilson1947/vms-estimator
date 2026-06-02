import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { Environment } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
const ALT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.fill  = HEADER_FILL;
    cell.font  = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF2563EB' } },
    };
  });
  row.height = 28;
}

function styleDataRow(row: ExcelJS.Row, i: number) {
  if (i % 2 === 0) {
    row.eachCell({ includeEmpty: true }, cell => { cell.fill = ALT_FILL; });
  }
  row.eachCell({ includeEmpty: true }, cell => {
    cell.font = { size: 9 };
    cell.alignment = { vertical: 'middle' };
  });
}

function yesNo(v: boolean | null | undefined) {
  return v ? 'Yes' : v === false ? 'No' : '';
}

// GET /api/reports/cameras.xlsx — Camera model catalog export
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const models = await prisma.cameraModel.findMany({
    orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CSMS';
  wb.created = new Date();

  // ─── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summary = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF1E3A5F' } } });
  summary.mergeCells('A1:C1');
  const titleCell = summary.getCell('A1');
  titleCell.value = 'Camera Model Catalog — Summary';
  titleCell.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  summary.getRow(1).height = 36;
  summary.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
  summary.getCell('A2').font  = { size: 9, italic: true, color: { argb: 'FF6B7280' } };

  const stats = [
    ['Total Models',     models.length],
    ['PTZ Capable',      models.filter(m => m.ptz).length],
    ['Night Vision',     models.filter(m => m.nightVision).length],
    ['Vandal Proof',     models.filter(m => m.vandalProof).length],
    ['Indoor',           models.filter(m => m.indoorOutdoor === Environment.INDOOR).length],
    ['Outdoor',          models.filter(m => m.indoorOutdoor === Environment.OUTDOOR).length],
    ['Both',             models.filter(m => m.indoorOutdoor === Environment.BOTH).length],
  ];
  let r = 4;
  for (const [label, val] of stats) {
    summary.getCell(`A${r}`).value = label; summary.getCell(`A${r}`).font = { bold: true, size: 10 };
    summary.getCell(`B${r}`).value = val;   summary.getCell(`B${r}`).font = { size: 10 };
    r++;
  }
  summary.getColumn('A').width = 22; summary.getColumn('B').width = 14;

  // ─── Sheet 2: Full Catalog ─────────────────────────────────────────────────
  const inv = wb.addWorksheet('Camera Catalog', { properties: { tabColor: { argb: 'FF2563EB' } } });
  const invCols: Array<{ header: string; key: string; width: number }> = [
    { header: 'Manufacturer',          key: 'manufacturer',       width: 18 },
    { header: 'Model',                 key: 'model',              width: 20 },
    { header: 'Type',                  key: 'cameraType',         width: 12 },
    { header: 'Environment',           key: 'indoorOutdoor',      width: 12 },
    { header: 'PTZ',                   key: 'ptz',                width: 8  },
    { header: 'Pan (deg)',             key: 'panDegrees',         width: 10 },
    { header: 'Zoom',                  key: 'zoomX',              width: 10 },
    { header: 'Resolution',            key: 'resolution',         width: 14 },
    { header: 'Megapixels',            key: 'megapixels',         width: 12 },
    { header: 'Resolution Class',      key: 'resolutionClass',    width: 14 },
    { header: 'FPS',                   key: 'fps',                width: 8  },
    { header: 'Lenses',                key: 'lensCount',          width: 9  },
    { header: 'Motorized Lens',        key: 'motorizedLens',      width: 14 },
    { header: 'Audio',                 key: 'audio',              width: 8  },
    { header: 'Microphone',            key: 'microphone',         width: 12 },
    { header: 'Motion Detection',      key: 'motionDetection',    width: 16 },
    { header: 'Night Vision',          key: 'nightVision',        width: 14 },
    { header: 'Range (ft)',            key: 'rangeFt',            width: 11 },
    { header: 'Human/Vehicle Detect',  key: 'humanVehicleDetect', width: 18 },
    { header: 'Vandal Proof',          key: 'vandalProof',        width: 13 },
    { header: 'SSD',                   key: 'ssd',                width: 8  },
    { header: 'Mount',                 key: 'mount',              width: 18 },
    { header: 'Cost ($)',              key: 'cost',               width: 12 },
    { header: 'URL',                   key: 'url',                width: 30 },
  ];
  inv.columns = invCols;
  styleHeaderRow(inv.getRow(1));
  models.forEach((m, i) => {
    let mountLabel = '';
    try { mountLabel = (JSON.parse(m.mount ?? '[]') as string[]).join(', '); } catch { mountLabel = m.mount ?? ''; }
    const row = inv.addRow({
      manufacturer: m.manufacturer ?? '',
      model:        m.model ?? '',
      cameraType:   m.cameraType ?? '',
      indoorOutdoor:m.indoorOutdoor ?? '',
      ptz:          yesNo(m.ptz),
      panDegrees:   m.panDegrees ?? '',
      zoomX:        m.zoomX ?? '',
      resolution:   m.resolution ?? '',
      megapixels:   m.megapixels != null ? Number(m.megapixels) : '',
      resolutionClass: m.resolutionClass ?? '',
      fps:          m.fps ?? '',
      lensCount:    m.lensCount ?? '',
      motorizedLens:yesNo(m.motorizedLens),
      audio:        yesNo(m.audio),
      microphone:   yesNo(m.microphone),
      motionDetection: yesNo(m.motionDetection),
      nightVision:  yesNo(m.nightVision),
      rangeFt:      m.rangeFt ?? '',
      humanVehicleDetect: yesNo(m.humanVehicleDetect),
      vandalProof:  yesNo(m.vandalProof),
      ssd:          yesNo(m.ssd),
      mount:        mountLabel,
      cost:         m.cost != null ? Number(m.cost) : '',
      url:          m.url ?? '',
    });
    styleDataRow(row, i);
  });
  inv.autoFilter  = { from: 'A1', to: `${String.fromCharCode(64 + invCols.length)}1` };
  inv.views       = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // ─── Serialize & Return ───────────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="camera-catalog-${date}.xlsx"`,
    },
  });
}
