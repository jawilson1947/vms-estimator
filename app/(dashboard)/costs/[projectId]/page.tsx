import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { CostEstimator } from '@/components/CostEstimator';

export const dynamic = 'force-dynamic';

export default async function ProjectCostPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where:   { id: Number(projectId) },
    include: {
      customer:   { select: { customerName: true } },
      costs:      {
        orderBy: [{ category: { sortOrder: 'asc' } }, { id: 'asc' }],
        include: { category: true },
      },
      feeSummary: true,
      cameraLocations: {
        orderBy: [{ floor: 'asc' }, { areaName: 'asc' }],
        include: {
          cameraModel:  true,
          accessMethod: { include: { items: { include: { artifactType: true } } } },
          generalItems: { include: { generalItem: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const isAccessControl = project.projectType === 'ACCESS_CONTROL';
  const isGeneral       = project.projectType === 'GENERAL';

  // Load stored markup overrides for survey camera rows (keyed by cameraModelId)
  const surveyOverrideRows = await prisma.projectCost.findMany({
    where: { projectId: Number(projectId), surveyLocationId: { not: null } },
    select: { id: true, cameraModelId: true, surveyLocationId: true, markupPercent: true },
  });
  const surveyOverrides: Record<number, { costId: number; markupPercent: number }> = {};
  const surveyOverrideIds = new Set<number>();
  for (const row of surveyOverrideRows) {
    if (row.cameraModelId != null) {
      surveyOverrides[row.cameraModelId] = { costId: row.id, markupPercent: Number(row.markupPercent) };
      surveyOverrideIds.add(row.id);
    }
  }

  // Flatten all locations with a valid catalog price, then group by camera model
  type SurveyGroup = {
    locationId: number; cameraModelId: number; description: string;
    quantity: number; unitCost: number; lineTotal: number;
  };
  const groupMap = new Map<number, SurveyGroup>();
  for (const l of project.cameraLocations) {
    if (!l.cameraModelId || !l.cameraModel?.cost) continue;
    const unitCost = Number(l.cameraModel.cost);
    if (unitCost <= 0) continue;
    const description = [l.cameraModel.manufacturer, l.cameraModel.model].filter(Boolean).join(' ') || 'Unspecified Camera';
    if (groupMap.has(l.cameraModelId)) {
      const g = groupMap.get(l.cameraModelId)!;
      g.quantity += 1;
      g.lineTotal = g.unitCost * g.quantity;
    } else {
      groupMap.set(l.cameraModelId, {
        locationId:    l.id,
        cameraModelId: l.cameraModelId,
        description,
        quantity:      1,
        unitCost,
        lineTotal:     unitCost,
      });
    }
  }
  const surveyItems = Array.from(groupMap.values());

  // ── Access Control BOM: aggregate method items across access points,
  //    keyed per (access method, artifact type) so e.g. internal vs external
  //    door equipment prices independently ──────────────────────────────────
  type BomItem = {
    accessMethodId: number; methodName: string; artifactTypeId: number; typeName: string;
    quantity: number; doorCount: number; notes: string[]; methodSort: number; sortOrder: number;
  };
  const bomMap = new Map<string, BomItem>();
  if (isAccessControl) {
    for (const l of project.cameraLocations) {
      if (!l.accessMethod) continue;
      for (const item of l.accessMethod.items) {
        const key = `${l.accessMethod.id}:${item.artifactTypeId}`;
        const existing = bomMap.get(key);
        if (existing) {
          existing.quantity  += item.quantity;
          existing.doorCount += 1;
          if (item.notes && !existing.notes.includes(item.notes)) existing.notes.push(item.notes);
        } else {
          bomMap.set(key, {
            accessMethodId: l.accessMethod.id,
            methodName:     l.accessMethod.name,
            artifactTypeId: item.artifactTypeId,
            typeName:       item.artifactType.name,
            quantity:       item.quantity,
            doorCount:      1,
            notes:          item.notes ? [item.notes] : [],
            methodSort:     l.accessMethod.sortOrder,
            sortOrder:      item.artifactType.sortOrder,
          });
        }
      }
    }
  }
  const bomItems = Array.from(bomMap.values())
    .sort((a, b) => a.methodSort - b.methodSort || a.sortOrder - b.sortOrder);

  // Persisted BOM overrides (committed ProjectCost rows keyed by accessMethodId:artifactTypeId)
  const bomOverrideRows = isAccessControl
    ? await prisma.projectCost.findMany({
        where:  { projectId: Number(projectId), artifactTypeId: { not: null } },
        select: { id: true, accessMethodId: true, artifactTypeId: true, artifactModelId: true, quantity: true, unitCost: true, markupPercent: true },
      })
    : [];
  const bomOverrides: Record<string, { costId: number; artifactModelId: number | null; quantity: number; unitCost: number; markupPercent: number; removed: boolean }> = {};
  const bomOverrideIds = new Set<number>();
  for (const row of bomOverrideRows) {
    // Rows are excluded from the plain line-item list even if legacy (null accessMethodId)
    bomOverrideIds.add(row.id);
    if (row.artifactTypeId != null && row.accessMethodId != null) {
      bomOverrides[`${row.accessMethodId}:${row.artifactTypeId}`] = {
        costId:          row.id,
        artifactModelId: row.artifactModelId,
        quantity:        Number(row.quantity),
        unitCost:        Number(row.unitCost),
        markupPercent:   Number(row.markupPercent),
        // quantity-0 marker = row removed from the cost list (legit rows are always >= 1)
        removed:         Number(row.quantity) === 0,
      };
    }
  }

  // ── General items: aggregate location assignments per catalog item ────────
  type GeneralBomItem = {
    generalItemId: number; name: string; quantity: number;
    locationCount: number; catalogCost: number; sortOrder: number;
  };
  const genMap = new Map<number, GeneralBomItem>();
  if (isGeneral) {
    for (const l of project.cameraLocations) {
      for (const a of l.generalItems) {
        const existing = genMap.get(a.generalItemId);
        if (existing) {
          existing.quantity      += Number(a.quantity);
          existing.locationCount += 1;
        } else {
          genMap.set(a.generalItemId, {
            generalItemId: a.generalItemId,
            name:          a.generalItem.name,
            quantity:      Number(a.quantity),
            locationCount: 1,
            catalogCost:   Number(a.generalItem.cost),
            sortOrder:     a.generalItem.sortOrder,
          });
        }
      }
    }
  }
  const generalItems = Array.from(genMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  // Persisted General overrides (committed ProjectCost rows keyed by generalItemId)
  const genOverrideRows = isGeneral
    ? await prisma.projectCost.findMany({
        where:  { projectId: Number(projectId), generalItemId: { not: null } },
        select: { id: true, generalItemId: true, quantity: true, unitCost: true, markupPercent: true },
      })
    : [];
  const generalOverrides: Record<number, { costId: number; quantity: number; unitCost: number; markupPercent: number; removed: boolean }> = {};
  const genOverrideIds = new Set<number>();
  for (const row of genOverrideRows) {
    genOverrideIds.add(row.id);
    if (row.generalItemId != null) {
      generalOverrides[row.generalItemId] = {
        costId:        row.id,
        quantity:      Number(row.quantity),
        unitCost:      Number(row.unitCost),
        markupPercent: Number(row.markupPercent),
        // quantity-0 marker = row removed from the cost list
        removed:       Number(row.quantity) === 0,
      };
    }
  }

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/costs" className="hover:text-gray-700">Cost Estimator</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{project.projectName}</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{project.projectName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {project.customer.customerName}
            {project.projectNumber && <span className="ml-2">{project.projectNumber}</span>}
          </p>
        </div>
        <Link href={`/projects/${project.id}`} className="btn-secondary text-xs">
          View Project →
        </Link>
      </div>

      <CostEstimator
        projectId={project.id}
        overheadRateDefault={project.overheadRatePercent ? Number(project.overheadRatePercent) : 15}
        surveyItems={surveyItems}
        surveyOverrides={surveyOverrides}
        bomItems={bomItems.map(({ sortOrder: _s, methodSort: _m, ...rest }) => rest)}
        bomOverrides={bomOverrides}
        generalItems={generalItems.map(({ sortOrder: _s, ...rest }) => rest)}
        generalOverrides={generalOverrides}
        initialCosts={project.costs.filter(c => !surveyOverrideIds.has(c.id) && !bomOverrideIds.has(c.id) && !genOverrideIds.has(c.id)).map(c => ({
          id:            c.id,
          categoryId:    c.categoryId,
          categoryName:  c.category.name,
          cameraModelId: c.cameraModelId ?? 0,
          description:   c.description  ?? '',
          quantity:      Number(c.quantity),
          unitCost:      Number(c.unitCost),
          markupPercent: Number(c.markupPercent),
          lineTotal:     Number(c.lineTotal ?? 0),
          vendor:        c.vendor   ?? '',
          url:           (c as Record<string, unknown>).url as string ?? '',
          billable:      c.billable,
          notes:         c.notes    ?? '',
        }))}
        initialSummary={project.feeSummary ? {
          overheadPercent:      Number(project.feeSummary.overheadPercent),
          overheadAmount:       Number(project.feeSummary.overheadAmount),
          consultingFee:        Number(project.feeSummary.consultingFee),
          projectManagementFee: Number(project.feeSummary.projectManagementFee),
          contingencyAmount:    Number(project.feeSummary.contingencyAmount),
          taxAmount:            Number(project.feeSummary.taxAmount),
          downPayment:          Number(project.feeSummary.downPayment ?? 0),
          grandTotal:           Number(project.feeSummary.grandTotal),
        } : null}
      />
    </div>
  );
}
