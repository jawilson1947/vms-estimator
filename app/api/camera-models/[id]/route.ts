import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CameraType, Environment } from '@prisma/client';

type Params = { params: { id: string } };

// GET /api/camera-models/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const model = await prisma.cameraModel.findUnique({
    where:   { id: Number(params.id) },
    include: { _count: { select: { cameras: true } } },
  });

  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(model);
}

// PUT /api/camera-models/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body  = await req.json();

  const model = await prisma.cameraModel.update({
    where: { id: Number(params.id) },
    data: {
      manufacturer:   body.manufacturer   || null,
      modelNumber:    body.modelNumber    || null,
      cameraType:     body.cameraType     as CameraType   || null,
      indoorOutdoor:  body.indoorOutdoor  as Environment  || null,
      resolution:     body.resolution     || null,
      lensType:       body.lensType       || null,
      focalLength:    body.focalLength    || null,
      fieldOfView:    body.fieldOfView    || null,
      irDistance:     body.irDistance     || null,
      wdr:            body.wdr            || null,
      lowLightRating: body.lowLightRating || null,
      codecSupport:   body.codecSupport   || null,
      poeStandard:    body.poeStandard    || null,
      maxPowerWatts:  body.maxPowerWatts  ? Number(body.maxPowerWatts)  : null,
      weatherRating:  body.weatherRating  || null,
      vandalRating:   body.vandalRating   || null,
      onvifProfile:   body.onvifProfile   || null,
      notes:          body.notes          || null,
    },
  });

  return NextResponse.json(model);
}

// DELETE /api/camera-models/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inUse = await prisma.camera.count({ where: { modelId: Number(params.id) } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${inUse} camera(s) are using this model.` },
      { status: 409 }
    );
  }

  await prisma.cameraModel.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ success: true });
}
