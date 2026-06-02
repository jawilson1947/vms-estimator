import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CameraType, Environment } from '@prisma/client';

// Map title-case UI values ("Dome", "Indoor") to Prisma uppercase enum keys

const CAMERA_TYPE_MAP: Record<string, CameraType> = {
  dome:    CameraType.DOME,
  fisheye: CameraType.FISHEYE,
  turret:  CameraType.TURRET,
  other:   CameraType.OTHER,
};

const ENVIRONMENT_MAP: Record<string, Environment> = {
  indoor:  Environment.INDOOR,
  outdoor: Environment.OUTDOOR,
  both:    Environment.BOTH,
};

function toCameraType(v: unknown): CameraType | null {
  if (!v || typeof v !== 'string') return null;
  return CAMERA_TYPE_MAP[v.toLowerCase()] ?? null;
}

function toEnvironment(v: unknown): Environment | null {
  if (!v || typeof v !== 'string') return null;
  return ENVIRONMENT_MAP[v.toLowerCase()] ?? null;
}

// GET /api/cameras
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const p               = new URL(req.url).searchParams;
  const search          = p.get('search')          ?? '';
  const type            = p.get('type')            ?? '';
  const indoorOutdoor   = p.get('indoorOutdoor')   ?? '';
  const ptz             = p.get('ptz')             ?? '';
  const resolutionClass = p.get('resolutionClass') ?? '';

  const cameraTypeFilter  = toCameraType(type);
  const environmentFilter = toEnvironment(indoorOutdoor);

  const models = await prisma.cameraModel.findMany({
    where: {
      ...(cameraTypeFilter  ? { cameraType:    cameraTypeFilter  } : {}),
      ...(environmentFilter ? { indoorOutdoor: environmentFilter } : {}),
      ...(ptz === 'true'  ? { ptz: true  } : {}),
      ...(ptz === 'false' ? { ptz: false } : {}),
      ...(resolutionClass ? { resolutionClass } : {}),
      ...(search ? {
        OR: [
          { manufacturer: { contains: search } },
          { model:        { contains: search } },
          { resolution:   { contains: search } },
        ],
      } : {}),
    },
    orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
  });

  return NextResponse.json(models);
}

// POST /api/cameras
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();

  const record = await prisma.cameraModel.create({
    data: buildData(b),
  });

  return NextResponse.json(record, { status: 201 });
}

export function buildData(b: Record<string, unknown>) {
  const str = (v: unknown) => (v && typeof v === 'string' ? v : null) as string | null;
  return {
    manufacturer:       str(b.manufacturer),
    model:              str(b.model),
    cameraType:         toCameraType(b.cameraType),
    ptz:                !!b.ptz,
    panDegrees:         b.panDegrees  ? Number(b.panDegrees)  : null,
    zoomX:              str(b.zoomX),
    audio:              !!b.audio,
    motionDetection:    !!b.motionDetection,
    resolution:         str(b.resolution),
    megapixels:         b.megapixels  ? Number(b.megapixels)  : null,
    cost:               b.cost        ? Number(b.cost)        : null,
    lensCount:          b.lensCount   ? Number(b.lensCount)   : null,
    motorizedLens:      !!b.motorizedLens,
    indoorOutdoor:      toEnvironment(b.indoorOutdoor),
    imageUrl:           str(b.imageUrl),
    nightVision:        !!b.nightVision,
    microphone:         !!b.microphone,
    rangeFt:            b.rangeFt     ? Number(b.rangeFt)     : null,
    resolutionClass:    str(b.resolutionClass),
    vandalProof:        !!b.vandalProof,
    url:                str(b.url),
    ssd:                !!b.ssd,
    fps:                b.fps         ? Number(b.fps)         : null,
    humanVehicleDetect: !!b.humanVehicleDetect,
    mount:              Array.isArray(b.mount) ? JSON.stringify(b.mount) : (str(b.mount)),
  };
}
