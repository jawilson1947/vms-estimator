import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, canEdit } from '@/lib/auth';
import { readSessionInfo } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { auditFromRequest } from '@/lib/auditLog';

// ─── POST /api/project-costs/copy ─────────────────────────────────────────────
// Copies selected cost line items from one project to another.
// Survey-linked rows (surveyLocationId set) are excluded — the Survey
// Management utility handles those. Values (unit cost, markup, cost date)
// are copied as-is; lineTotal is recomputed by the database.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const info = readSessionInfo(session);
  if (!info || !canEdit(info.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    sourceProjectId: number;
    targetProjectId: number;
    costIds: number[];
  };

  const sourceProjectId = Number(body.sourceProjectId);
  const targetProjectId = Number(body.targetProjectId);
  const costIds = Array.isArray(body.costIds) ? body.costIds.map(Number) : [];

  if (!sourceProjectId || isNaN(sourceProjectId))
    return NextResponse.json({ error: 'sourceProjectId is required' }, { status: 400 });
  if (!targetProjectId || isNaN(targetProjectId))
    return NextResponse.json({ error: 'targetProjectId is required' }, { status: 400 });
  if (sourceProjectId === targetProjectId)
    return NextResponse.json({ error: 'Source and target project must differ' }, { status: 400 });
  if (costIds.length === 0)
    return NextResponse.json({ error: 'costIds must be a non-empty array' }, { status: 400 });

  const projects = await prisma.project.findMany({
    where:  { id: { in: [sourceProjectId, targetProjectId] } },
    select: { id: true },
  });
  if (!projects.some(p => p.id === sourceProjectId))
    return NextResponse.json({ error: 'Source project not found' }, { status: 404 });
  if (!projects.some(p => p.id === targetProjectId))
    return NextResponse.json({ error: 'Target project not found' }, { status: 404 });

  // Fetch source rows. Backstop filters: rows must belong to the source
  // project, must not be survey-linked, and must not be soft-deleted (qty 0).
  const sources = await prisma.projectCost.findMany({
    where: {
      id:               { in: costIds },
      projectId:        sourceProjectId,
      surveyLocationId: null,
      quantity:         { gt: 0 },
    },
  });

  const skipped = costIds.length - sources.length;

  if (sources.length === 0)
    return NextResponse.json({ error: 'No copyable cost items found (survey-linked items are excluded)' }, { status: 404 });

  // lineTotal is a DB-computed column — omit it and let the database recompute.
  const created = await prisma.projectCost.createMany({
    data: sources.map(c => ({
      projectId:        targetProjectId,
      categoryId:       c.categoryId,
      cameraModelId:    c.cameraModelId,
      description:      c.description,
      quantity:         c.quantity,
      unitCost:         c.unitCost,
      markupPercent:    c.markupPercent,
      vendor:           c.vendor,
      url:              c.url,
      costDate:         c.costDate,
      billable:         c.billable,
      notes:            c.notes,
      surveyLocationId: null,
      artifactTypeId:   c.artifactTypeId,
      artifactModelId:  c.artifactModelId,
      accessMethodId:   c.accessMethodId,
    })),
  });

  await auditFromRequest(req, 'COST_ITEMS_COPIED', {
    entityType: 'Project',
    entityId:   targetProjectId,
    detail:     `Copied ${created.count} cost item(s) from project ${sourceProjectId} to project ${targetProjectId}` +
                (skipped > 0 ? ` (${skipped} skipped)` : ''),
  });

  return NextResponse.json({ copied: created.count, skipped });
}
