import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

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

// GET /api/reports/cameras.xlsx
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cameras = await prisma.camera.findMany({
    include: {
      model:    true,
      location: { include: { building: { include: { site: { include: { customer: true } } } } } },
    },
    orderBy: [{ location: { building: { site: { siteName: 'asc' } } } }, { cameraCode: 'asc' }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator    = 'CSMS';
  wb.created    = new Date();
  wb.properties.date1904 = false;

  // ─── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summary = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF1E3A5F' } } });
  summary.mergeCells('A1:D1');
  const titleCell = summary.getCell('A1');
  titleCell.value = 'Camera Inventory — Summary';
  titleCell.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  summary.getRow(1).height = 36;

  summary.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
  summary.getCell('A2').font  = { size: 9, italic: true, color: { argb: 'FF6B7280' } };
  summary.getRow(2).height = 18;

  // Stats
  const statusCounts = cameras.reduce<Record<string, number>>((a, c) => {
    a[c.status] = (a[c.status] ?? 0) + 1; return a;
  }, {});

  const stats = [
    ['Total Cameras',     cameras.length],
    ['Active',           statusCounts['ACTIVE']      ?? 0],
    ['Installed',        statusCounts['INSTALLED']    ?? 0],
    ['Offline',          statusCounts['OFFLINE']      ?? 0],
    ['Needs Repair',     statusCounts['NEEDS_REPAIR'] ?? 0],
    ['Planned',          statusCounts['PLANNED']      ?? 0],
    ['Retired',          statusCounts['RETIRED']      ?? 0],
    ['', ''],
    ['HTTPS Enabled',    cameras.filter(c => c.httpsEnabled).length],
    ['Username Changed', cameras.filter(c => c.usernameChanged).length],
    ['Privacy Mask',     cameras.filter(c => c.privacyMaskEnabled).length],
  ];

  let r = 4;
  for (const [label, val] of stats) {
    if (!label) { r++; continue; }
    summary.getCell(`A${r}`).value = label;
    summary.getCell(`A${r}`).font  = { bold: true, size: 10 };
    summary.getCell(`B${r}`).value = val;
    summary.getCell(`B${r}`).font  = { size: 10 };
    r++;
  }
  summary.getColumn('A').width = 22;
  summary.getColumn('B').width = 14;

  // ─── Sheet 2: Full Inventory ───────────────────────────────────────────────
  const inv = wb.addWorksheet('Full Inventory', { properties: { tabColor: { argb: 'FF2563EB' } } });

  const invCols: Array<{ header: string; key: string; width: number }> = [
    { header: 'Camera Code',     key: 'cameraCode',     width: 16 },
    { header: 'Camera Name',     key: 'cameraName',     width: 22 },
    { header: 'Status',          key: 'status',         width: 14 },
    { header: 'Site',            key: 'site',           width: 20 },
    { header: 'Customer',        key: 'customer',       width: 20 },
    { header: 'Building',        key: 'building',       width: 18 },
    { header: 'Area / Location', key: 'area',           width: 20 },
    { header: 'Floor',           key: 'floor',          width: 8 },
    { header: 'Manufacturer',    key: 'manufacturer',   width: 16 },
    { header: 'Model Number',    key: 'modelNumber',    width: 16 },
    { header: 'Camera Type',     key: 'cameraType',     width: 14 },
    { header: 'Resolution',      key: 'resolution',     width: 12 },
    { header: 'Lens Type',       key: 'lensType',       width: 14 },
    { header: 'Field of View',   key: 'fieldOfView',    width: 12 },
    { header: 'IR Distance',     key: 'irDistance',     width: 12 },
    { header: 'IP Address',      key: 'ipAddress',      width: 14 },
    { header: 'MAC Address',     key: 'macAddress',     width: 16 },
    { header: 'VLAN',            key: 'vlanId',         width: 10 },
    { header: 'Switch',          key: 'switchName',     width: 16 },
    { header: 'Switch Port',     key: 'switchPort',     width: 12 },
    { header: 'NVR',             key: 'nvrName',        width: 16 },
    { header: 'Recording Mode',  key: 'recordingMode',  width: 14 },
    { header: 'Retention (days)',key: 'retentionDays',  width: 14 },
    { header: 'Bitrate (Mbps)',  key: 'bitrateMbps',    width: 13 },
    { header: 'Frame Rate',      key: 'frameRate',      width: 11 },
    { header: 'Serial Number',   key: 'serialNumber',   width: 18 },
    { header: 'Asset Tag',       key: 'assetTag',       width: 14 },
    { header: 'Firmware',        key: 'firmwareVersion',width: 14 },
    { header: 'Install Date',    key: 'installDate',    width: 14 },
    { header: 'Warranty Exp.',   key: 'warrantyExpiry', width: 14 },
    { header: 'HTTPS',           key: 'https',          width: 8  },
    { header: 'User Changed',    key: 'userChanged',    width: 12 },
    { header: 'Privacy Mask',    key: 'privacyMask',    width: 12 },
    { header: 'PoE (W)',         key: 'poeWatts',       width: 9  },
    { header: 'Notes',           key: 'notes',          width: 30 },
  ];

  inv.columns = invCols;
  styleHeaderRow(inv.getRow(1));

  cameras.forEach((cam, i) => {
    const loc  = cam.location;
    const bldg = loc?.building;
    const site = bldg?.site;
    const row  = inv.addRow({
      cameraCode:     cam.cameraCode,
      cameraName:     cam.cameraName,
      status:         cam.status.replace('_', ' '),
      site:           site?.siteName ?? '',
      customer:       site?.customer?.customerName ?? '',
      building:       bldg?.buildingName ?? '',
      area:           loc?.areaName ?? loc?.mountingLocation ?? '',
      floor:          loc?.floor ?? '',
      manufacturer:   cam.model?.manufacturer ?? '',
      modelNumber:    cam.model?.modelNumber ?? '',
      cameraType:     cam.model?.cameraType ?? '',
      resolution:     cam.model?.resolution ?? '',
      lensType:       cam.model?.lensType ?? '',
      fieldOfView:    cam.model?.fieldOfView ?? '',
      irDistance:     cam.model?.irDistance ?? '',
      ipAddress:      cam.ipAddress ?? '',
      macAddress:     cam.macAddress ?? '',
      vlanId:         cam.vlanId != null ? String(cam.vlanId) : '',
      switchName:     cam.switchName ?? '',
      switchPort:     cam.switchPort ?? '',
      nvrName:        cam.nvrName ?? '',
      recordingMode:  cam.recordingMode ?? '',
      retentionDays:  cam.retentionDays ?? '',
      bitrateMbps:    cam.bitrateMbps != null ? Number(cam.bitrateMbps) : '',
      frameRate:      cam.frameRate ?? '',
      serialNumber:   cam.serialNumber ?? '',
      assetTag:       cam.assetTag ?? '',
      firmwareVersion:cam.firmwareVersion ?? '',
      installDate:    cam.installDate ? new Date(cam.installDate).toLocaleDateString() : '',
      warrantyExpiry: cam.warrantyExpiration ? new Date(cam.warrantyExpiration).toLocaleDateString() : '',
      https:          yesNo(cam.httpsEnabled),
      userChanged:    yesNo(cam.usernameChanged),
      privacyMask:    yesNo(cam.privacyMaskEnabled),
      poeWatts:       cam.model?.maxPowerWatts != null ? Number(cam.model.maxPowerWatts) : '',
      notes:          cam.notes ?? '',
    });
    styleDataRow(row, i);
  });

  // Auto-filter
  inv.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + invCols.length)}1` };

  // Freeze header
  inv.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // ─── Sheet 3: By Site ─────────────────────────────────────────────────────
  const bySite = wb.addWorksheet('By Site', { properties: { tabColor: { argb: 'FF16A34A' } } });

  // Group cameras by site
  const siteMap = new Map<string, typeof cameras>();
  for (const cam of cameras) {
    const siteName = cam.location?.building?.site?.siteName ?? 'Unassigned';
    if (!siteMap.has(siteName)) siteMap.set(siteName, []);
    siteMap.get(siteName)!.push(cam);
  }

  const siteHdrCols = [
    { header: 'Camera Code', width: 16 }, { header: 'Camera Name', width: 22 },
    { header: 'Status', width: 14 },      { header: 'Building', width: 18 },
    { header: 'Area', width: 20 },        { header: 'IP Address', width: 14 },
    { header: 'Model', width: 18 },       { header: 'Type', width: 14 },
    { header: 'HTTPS', width: 8 },        { header: 'PoE (W)', width: 9 },
  ];

  let rowIdx = 1;
  for (const [siteName, cams] of Array.from(siteMap.entries())) {
    // Site header
    bySite.mergeCells(`A${rowIdx}:J${rowIdx}`);
    const siteHdrCell = bySite.getCell(`A${rowIdx}`);
    siteHdrCell.value = `${siteName}  (${cams.length} cameras)`;
    siteHdrCell.font  = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    siteHdrCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    siteHdrCell.alignment = { vertical: 'middle', indent: 1 };
    bySite.getRow(rowIdx).height = 24;
    rowIdx++;

    // Column headers
    const hdrRow = bySite.getRow(rowIdx);
    siteHdrCols.forEach((col, ci) => {
      const cell = hdrRow.getCell(ci + 1);
      cell.value = col.header;
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0ECFA' } };
      cell.font  = { bold: true, size: 9, color: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      bySite.getColumn(ci + 1).width = col.width;
    });
    bySite.getRow(rowIdx).height = 20;
    rowIdx++;

    // Data rows
    for (const cam of cams) {
      const dr = bySite.getRow(rowIdx);
      const vals = [
        cam.cameraCode,
        cam.cameraName,
        cam.status.replace('_', ' '),
        cam.location?.building?.buildingName ?? '',
        cam.location?.areaName ?? cam.location?.mountingLocation ?? '',
        cam.ipAddress ?? '',
        cam.model ? `${cam.model.manufacturer ?? ''} ${cam.model.modelNumber ?? ''}`.trim() : '',
        cam.model?.cameraType ?? '',
        yesNo(cam.httpsEnabled),
        cam.model?.maxPowerWatts != null ? Number(cam.model.maxPowerWatts) : '',
      ];
      vals.forEach((v, ci) => {
        dr.getCell(ci + 1).value = v as any;
        dr.getCell(ci + 1).font = { size: 9 };
        dr.getCell(ci + 1).alignment = { vertical: 'middle' };
      });
      rowIdx++;
    }

    // Blank separator
    rowIdx += 2;
  }

  // ─── Serialize & Return ───────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="camera-inventory-${date}.xlsx"`,
    },
  });
}
    },
  });
}
