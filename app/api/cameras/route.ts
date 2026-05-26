import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CameraStatus, RecordingMode } from '@prisma/client';

// GET /api/cameras
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const p          = new URL(req.url).searchParams;
  const search     = p.get('search')     ?? '';
  const status     = p.get('status')     ?? '';
  const modelId    = p.get('modelId')    ?? '';
  const buildingId = p.get('buildingId') ?? '';
  const vlanId     = p.get('vlanId')     ?? '';

  const cameras = await prisma.camera.findMany({
    where: {
      ...(status     ? { status:              status as CameraStatus }   : {}),
      ...(modelId    ? { modelId:             Number(modelId) }          : {}),
      ...(vlanId     ? { vlanId:              Number(vlanId)  }          : {}),
      ...(buildingId ? { location: { buildingId: Number(buildingId) } }  : {}),
      ...(search
        ? {
            OR: [
              { cameraCode: { contains: search } },
              { cameraName: { contains: search } },
              { ipAddress:  { contains: search } },
              { serialNumber: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      model:    { select: { id: true, manufacturer: true, modelNumber: true, cameraType: true } },
      location: {
        select: { id: true, areaName: true, floor: true,
          building: { select: { id: true, buildingName: true,
            site: { select: { id: true, siteName: true } } } } },
      },
    },
    orderBy: { cameraCode: 'asc' },
  });

  return NextResponse.json(cameras);
}

// POST /api/cameras
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();

  if (!b.cameraCode?.trim()) return NextResponse.json({ error: 'Camera code is required' }, { status: 400 });
  if (!b.cameraName?.trim()) return NextResponse.json({ error: 'Camera name is required' }, { status: 400 });

  const camera = await prisma.camera.create({
    data: {
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
      status:            b.status as CameraStatus || CameraStatus.PLANNED,
      notes:             b.notes || null,
    },
  });

  return NextResponse.json(camera, { status: 201 });
}
