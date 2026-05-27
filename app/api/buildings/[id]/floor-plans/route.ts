import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { put, del } from '@vercel/blob';

type Params = { params: Promise<{ id: string }> };

// GET /api/buildings/[id]/floor-plans
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const buildingId = parseInt(id);
  if (isNaN(buildingId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const rows = await prisma.$queryRaw<FloorPlanRow[]>`
    SELECT plan_id, building_id, floor, file_name, original_file_name,
           file_path, file_url, file_size_bytes, uploaded_by, uploaded_at
    FROM   building_floor_plans
    WHERE  building_id = ${buildingId}
    ORDER  BY floor ASC
  `;

  return NextResponse.json(rows.map(normalise));
}

// POST /api/buildings/[id]/floor-plans
// form-data: pdf (File), floor (string)
// Replaces any existing plan for that floor.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const buildingId = parseInt(id);
  if (isNaN(buildingId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const formData = await req.formData();
  const file  = formData.get('pdf') as File | null;
  const floor = ((formData.get('floor') as string) ?? '').trim();

  if (!file) return NextResponse.json({ error: 'No PDF provided' }, { status: 400 });
  if (!floor) return NextResponse.json({ error: 'Floor label is required' }, { status: 400 });

  // Delete existing plan for this floor
  const existing = await prisma.$queryRaw<FloorPlanRow[]>`
    SELECT plan_id, file_url FROM building_floor_plans
    WHERE  building_id = ${buildingId} AND floor = ${floor}
    LIMIT  1
  `;
  if (existing.length > 0) {
    try { if (existing[0].file_url) await del(existing[0].file_url); } catch { /* already gone */ }
    await prisma.$executeRaw`
      DELETE FROM building_floor_plans WHERE plan_id = ${existing[0].plan_id}
    `;
  }

  // Upload to Vercel Blob
  const safeName = floor.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const fileName = `fp-${buildingId}-${safeName}-${Date.now()}.pdf`;

  const blob = await put(`floor-plans/${fileName}`, file, {
    access: 'public',
    contentType: 'application/pdf',
  });

  await prisma.$executeRaw`
    INSERT INTO building_floor_plans
      (building_id, floor, file_name, original_file_name, file_path, file_url,
       file_size_bytes, uploaded_by, uploaded_at)
    VALUES
      (${buildingId}, ${floor}, ${fileName}, ${file.name}, ${blob.url}, ${blob.url},
       ${BigInt(file.size)}, ${session.user?.email ?? 'unknown'}, NOW(3))
  `;

  const [row] = await prisma.$queryRaw<FloorPlanRow[]>`
    SELECT plan_id, building_id, floor, file_name, original_file_name,
           file_path, file_url, file_size_bytes, uploaded_by, uploaded_at
    FROM   building_floor_plans
    WHERE  building_id = ${buildingId} AND floor = ${floor}
    LIMIT  1
  `;

  return NextResponse.json(normalise(row), { status: 201 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FloorPlanRow {
  plan_id:            number;
  building_id:        number;
  floor:              string;
  file_name:          string;
  original_file_name: string | null;
  file_path:          string;
  file_url:           string | null;
  file_size_bytes:    bigint | null;
  uploaded_by:        string | null;
  uploaded_at:        Date;
}

function normalise(r: FloorPlanRow) {
  return {
    id:               r.plan_id,
    buildingId:       r.building_id,
    floor:            r.floor,
    fileName:         r.file_name,
    originalFileName: r.original_file_name,
    fileUrl:          r.file_url,
    fileSizeBytes:    r.file_size_bytes ? Number(r.file_size_bytes) : null,
    uploadedBy:       r.uploaded_by,
    uploadedAt:       r.uploaded_at instanceof Date ? r.uploaded_at.toISOString() : String(r.uploaded_at),
  };
}
