import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CameraType, Environment } from '@prisma/client';

// GET /api/camera-models
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const search = new URL(req.url).searchParams.get('search') ?? '';

  const models = await prisma.cameraModel.findMany({
    where: search
      ? { OR: [{ manufacturer: { contains: search } }, { modelNumber: { contains: search } }] }
      : undefined,
    include: { _count: { select: { cameras: true } } },
    orderBy: [{ manufacturer: 'asc' }, { modelNumber: 'asc' }],
  });

  return NextResponse.json(models);
}

// POST /api/camera-models
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const model = await prisma.cameraModel.create({
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

  return NextResponse.json(model, { status: 201 });
}
