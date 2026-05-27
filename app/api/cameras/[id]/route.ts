import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CameraStatus, RecordingMode } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

// GET /api/cameras/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const camera = await prisma.camera.findUnique({
    where:   { id: Number(id) },
    include: {
      model:             true,
      location: {
        include: {
          building: { include: { site: true } },
        },
      },
      images:            { orderBy: { uploadedAt: 'desc' } },
      maintenanceRecords:{ orderBy: { serviceDate: 'desc' } },
    },
  });

  if (!camera) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(camera);
}

// PUT /api/cameras/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();

  if (!b.cameraCode?.trim()) return NextResponse.json({ error: 'Camera code is required' }, { status: 400 });
  if (!b.cameraName?.trim()) return NextResponse.json({ error: 'Camera name is required' }, { status: 400 });

  const camera = await prisma.camera.update({
    where: { id: Number(id) },
    data:  {
      cameraCode:        b.cameraCode.trim(),
      cameraName:        b.cameraName.trim(),
      modelId:           b.modelId    ? Number(b.modelId)    : null,
      locationId:        b.locationId ? Number(b.locationId) : null,
      serialNumber:      b.serialNumber      || null,
      assetTag:          b.assetTag          || null,
      ipAddress:         b.ipAddress         || null,
      macAddress:        b.macAddress        || null,
      vlanId:            b.vlanId            ? Number(b.vlanId)     : null,
      switchName:        b.switchName        || null,
      switchPort:        b.switchPort        || null,
      nvrName:           b.nvrName           || null,
      recordingMode:     b.recordingMode     as RecordingMode || null,
      retentionDays:     b.retentionDays     ? Number(b.retentionDays)  : null,
      bitrateMbps:       b.bitrateMbps       ? Number(b.bitrateMbps)    : null,
      frameRate:         b.frameRate         ? Number(b.frameRate)      : null,
      installDate:       b.installDate       ? new Date(b.installDate)        : null,
      warrantyExpiration:b.warrantyExpiration? new Date(b.warrantyExpiration) : null,
      firmwareVersion:   b.firmwareVersion   || null,
      usernameChanged:   !!b.usernameChanged,
      httpsEnabled:      !!b.httpsEnabled,
      privacyMaskEnabled:!!b.privacyMaskEnabled,
      status:            b.status as CameraStatus,
      notes:             b.notes || null,
    },
  });

  return NextResponse.json(camera);
}

// DELETE /api/cameras/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.camera.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
