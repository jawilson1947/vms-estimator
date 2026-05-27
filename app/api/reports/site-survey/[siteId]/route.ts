import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PDFDocument from 'pdfkit';

const NAVY  = '#1E3A5F';
const BLUE  = '#2563EB';
const GREEN = '#16A34A';
const AMBER = '#D97706';
const RED   = '#DC2626';
const GRAY  = '#6B7280';
const LGRAY = '#F3F4F6';

// GET /api/reports/site-survey/[siteId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId: siteIdStr } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = parseInt(siteIdStr);
  if (isNaN(siteId)) return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      customer: { select: { customerName: true, contactName: true, phone: true, email: true } },
      buildings: {
        include: {
          locations: {
            include: {
              cameras: {
                include: { model: true },
              },
            },
          },
        },
        orderBy: { buildingName: 'asc' },
      },
    },
  });

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finish = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const pageW  = doc.page.width;
  const margin = 50;
  const inner  = pageW - margin * 2;
  const date   = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Flatten cameras
  const allCameras = site.buildings.flatMap(b =>
    b.locations.flatMap(l => l.cameras.map(c => ({ ...c, building: b, location: l })))
  );

  const totalCameras = allCameras.length;
  const httpsOk  = allCameras.filter(c => c.httpsEnabled).length;
  const userOk   = allCameras.filter(c => c.usernameChanged).length;
  const poeTotal = allCameras.reduce((s, c) => s + (c.model?.maxPowerWatts ? Number(c.model.maxPowerWatts) : 0), 0);

  // Storage estimate (GB): bitrate * retention * cameras / 8 / 1000
  const storageTB = allCameras.reduce((s, c) => {
    const mbps = c.bitrateMbps ? Number(c.bitrateMbps) : 4;
    const days = c.retentionDays ?? 30;
    return s + (mbps * days * 86400) / 8 / 1e9;
  }, 0);

  // ── Cover header ──────────────────────────────────────────────────────────
  doc.rect(0, 0, pageW, 90).fill(NAVY);
  doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
     .text('Site Survey Report', margin, 18);
  doc.fontSize(13).font('Helvetica')
     .text(site.siteName, margin, 44);
  doc.fillColor('#CBD5E1').fontSize(9)
     .text(`${site.customer?.customerName ?? ''}   ·   ${date}`, margin, 66);
  doc.moveDown(4);

  let y = doc.y + 6;

  // ── Site info block ───────────────────────────────────────────────────────
  const infoLeft  = [
    ['Address',  site.address ?? '—'],
    ['City',     [site.city, site.state].filter(Boolean).join(', ') || '—'],
    ['Contact',  site.customer?.contactName ?? '—'],
    ['Phone',    site.customer?.phone ?? '—'],
  ];
  const infoRight = [
    ['Buildings', String(site.buildings.length)],
    ['Cameras',   String(totalCameras)],
    ['PoE Total', `${poeTotal.toFixed(0)} W`],
    ['Storage Est.', `${storageTB.toFixed(1)} TB`],
  ];

  doc.rect(margin, y, inner / 2 - 4, 76).fill(LGRAY);
  doc.rect(margin + inner / 2 + 4, y, inner / 2 - 4, 76).fill(LGRAY);

  doc.fillColor(GRAY).fontSize(7.5).font('Helvetica');
  infoLeft.forEach(([k, v], i) => {
    doc.fillColor(GRAY).text(k, margin + 8, y + 8 + i * 16);
    doc.fillColor('#111827').font('Helvetica-Bold').text(v, margin + 80, y + 8 + i * 16);
    doc.font('Helvetica');
  });
  infoRight.forEach(([k, v], i) => {
    const rx = margin + inner / 2 + 12;
    doc.fillColor(GRAY).text(k, rx, y + 8 + i * 16);
    doc.fillColor('#111827').font('Helvetica-Bold').text(v, rx + 80, y + 8 + i * 16);
    doc.font('Helvetica');
  });

  y += 90;

  // ── Compliance summary bar ────────────────────────────────────────────────
  doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold').text('Security Compliance', margin, y);
  y += 16;

  const compItems = [
    { label: 'HTTPS Enabled',     val: httpsOk, total: totalCameras },
    { label: 'Username Changed',  val: userOk,  total: totalCameras },
  ];
  for (const ci of compItems) {
    const pctVal = ci.total > 0 ? ci.val / ci.total : 0;
    const barW   = inner - 140;
    doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(ci.label, margin, y + 2, { width: 130 });
    doc.rect(margin + 140, y, barW, 12).fill('#E5E7EB');
    doc.rect(margin + 140, y, barW * pctVal, 12).fill(pctVal >= 0.9 ? GREEN : pctVal >= 0.6 ? AMBER : RED);
    doc.fillColor('#111827').text(`${ci.val}/${ci.total}`, margin + 140 + barW + 6, y + 1);
    y += 20;
  }

  y += 8;
  doc.moveTo(margin, y).lineTo(margin + inner, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  y += 14;

  // ── Per-building camera tables ─────────────────────────────────────────────
  for (const bldg of site.buildings) {
    const bCams = bldg.locations.flatMap(l => l.cameras.map(c => ({ ...c, location: l })));
    if (bCams.length === 0) continue;

    // Building header
    doc.rect(margin, y, inner, 20).fill(BLUE);
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
       .text(`${bldg.buildingName}  (${bCams.length} cameras)`, margin + 8, y + 6);
    y += 20;

    // Column headers
    const cx  = [margin, margin + 90, margin + 190, margin + 270, margin + 340, margin + 400, margin + 440];
    const cw  = [85,      95,          75,           65,           55,           35,            inner - (440 - margin + 35)];
    const chs = ['Code', 'Location', 'Model', 'IP Address', 'Status', 'HTTPS', 'Firmware'];

    doc.rect(margin, y, inner, 16).fill('#EEF2FF');
    doc.fillColor(NAVY).fontSize(7.5).font('Helvetica-Bold');
    chs.forEach((h, i) => doc.text(h, cx[i] + 3, y + 4, { width: cw[i] }));
    y += 16;

    doc.fillColor('#111827').font('Helvetica').fontSize(7.5);
    bCams.forEach((cam, ri) => {
      if (ri % 2 === 0) doc.rect(margin, y, inner, 14).fill('#F9FAFB');
      const modelStr = cam.model ? `${cam.model.manufacturer ?? ''} ${cam.model.modelNumber ?? ''}`.trim() : '';
      doc.fillColor('#111827').text(cam.cameraCode, cx[0] + 3, y + 3, { width: cw[0] });
      doc.fillColor(GRAY)     .text(cam.location.areaName ?? '', cx[1] + 3, y + 3, { width: cw[1] });
      doc.fillColor('#111827').text(modelStr.substring(0, 18), cx[2] + 3, y + 3, { width: cw[2] });
      doc.text(cam.ipAddress ?? '—', cx[3] + 3, y + 3, { width: cw[3] });
      doc.fillColor(cam.status === 'ACTIVE' ? GREEN : cam.status === 'OFFLINE' ? RED : GRAY)
         .text(cam.status.replace('_', ' '), cx[4] + 3, y + 3, { width: cw[4] });
      doc.fillColor(cam.httpsEnabled ? GREEN : RED)
         .text(cam.httpsEnabled ? 'Yes' : 'No', cx[5] + 3, y + 3, { width: cw[5] });
      doc.fillColor(GRAY)
         .text(cam.firmwareVersion ?? '—', cx[6] + 3, y + 3, { width: Math.max(cw[6], 40) });
      y += 14;

      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
      }
    });

    y += 10;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 36;
  doc.moveTo(margin, footerY).lineTo(margin + inner, footerY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  doc.fillColor(GRAY).fontSize(8).font('Helvetica')
     .text('CSMS — Confidential', margin, footerY + 8)
     .text(date, margin, footerY + 8, { width: inner, align: 'right' });

  doc.end();
  const buf = await finish;

  const dateStr = new Date().toISOString().slice(0, 10);
  const slug    = site.siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="site-survey-${slug}-${dateStr}.pdf"`,
    },
  });
}
