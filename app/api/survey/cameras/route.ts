import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/survey/cameras — full camera model catalog for the picker
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const models = await prisma.cameraModel.findMany({
    select: {
      id:                 true,
      manufacturer:       true,
      model:              true,
      cameraType:         true,
      ptz:                true,
      resolution:         true,
      resolutionClass:    true,
      megapixels:         true,
      indoorOutdoor:      true,
      imageUrl:           true,
      nightVision:        true,
      vandalProof:        true,
      audio:              true,
      humanVehicleDetect: true,
      mount:              true,
      cost:               true,
    },
    orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
  });

  return NextResponse.json(models);
}
