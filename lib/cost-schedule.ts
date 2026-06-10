/**
 * Shared cost-schedule builder — usable both server-side (generators) and
 * client-side (browser preview). No Node.js or Prisma imports.
 */

export interface CostScheduleGroup {
  category:      string;
  description:   string;
  quantity:      number;
  unitCost:      number;
  markupPercent: number;
  lineTotal:     number;
}

export interface CostScheduleData {
  groups:                CostScheduleGroup[];
  directTotal:           number;
  overheadPercent:       number;
  overheadAmount:        number;
  consultingFee:         number;
  projectManagementFee:  number;
  contingencyAmount:     number;
  taxAmount:             number;
  grandTotal:            number;
}

interface CamLocInput {
  cameraModelId?: number | null;
  cameraModel?: {
    manufacturer?: string | null;
    model?:        string | null;
    cost?:         unknown;
  } | null;
}

interface CostInput {
  surveyLocationId?: unknown;
  cameraModelId?:    number | null;
  markupPercent?:    unknown;
  category:          { name: string };
  description?:      string | null;
  quantity:          unknown;
  unitCost:          unknown;
  lineTotal?:        unknown;
}

interface FeeSummaryInput {
  overheadPercent?:      unknown;
  consultingFee?:        unknown;
  projectManagementFee?: unknown;
  contingencyAmount?:    unknown;
  taxAmount?:            unknown;
}

function n(v: unknown): number { return Number(v ?? 0); }

export function buildCostSchedule(
  cameraLocations: CamLocInput[],
  costs:           CostInput[],
  feeSummary:      FeeSummaryInput | null | undefined,
): CostScheduleData {
  // Markup overrides keyed by cameraModelId (from survey ProjectCost records)
  const markupByModel = new Map<number, number>();
  for (const c of costs) {
    if (c.surveyLocationId != null && c.cameraModelId != null) {
      markupByModel.set(c.cameraModelId, n(c.markupPercent));
    }
  }

  const groups: CostScheduleGroup[] = [];

  // -- Survey cameras grouped by model --
  const surveyMap = new Map<number, { description: string; quantity: number; unitCost: number }>();
  for (const loc of cameraLocations) {
    const modelId = loc.cameraModelId;
    if (!modelId || !loc.cameraModel?.cost) continue;
    const unitCost = n(loc.cameraModel.cost);
    if (unitCost <= 0) continue;
    const desc = [loc.cameraModel.manufacturer, loc.cameraModel.model]
      .filter(Boolean).join(' ') || 'Unspecified Camera';
    const entry = surveyMap.get(modelId);
    if (entry) { entry.quantity += 1; }
    else { surveyMap.set(modelId, { description: desc, quantity: 1, unitCost }); }
  }
  for (const [modelId, g] of surveyMap) {
    const markup    = markupByModel.get(modelId) ?? 0;
    const lineTotal = g.unitCost * (1 + markup / 100) * g.quantity;
    groups.push({
      category: 'Survey Cameras',
      description: g.description,
      quantity: g.quantity,
      unitCost: g.unitCost,
      markupPercent: markup,
      lineTotal,
    });
  }

  // -- Manual costs (exclude survey markup override records) --
  for (const c of costs.filter(c => c.surveyLocationId == null)) {
    groups.push({
      category:      c.category.name,
      description:   c.description ?? '',
      quantity:      n(c.quantity),
      unitCost:      n(c.unitCost),
      markupPercent: n(c.markupPercent),
      lineTotal:     n(c.lineTotal),
    });
  }

  const directTotal          = groups.reduce((s, g) => s + g.lineTotal, 0);
  const overheadPct          = n(feeSummary?.overheadPercent);
  const overheadAmount       = directTotal * (overheadPct / 100);
  const consultingFee        = n(feeSummary?.consultingFee);
  const projectManagementFee = n(feeSummary?.projectManagementFee);
  const contingencyAmount    = n(feeSummary?.contingencyAmount);
  const taxAmount            = n(feeSummary?.taxAmount);
  const grandTotal           = directTotal + overheadAmount + consultingFee
                             + projectManagementFee + contingencyAmount + taxAmount;

  return {
    groups,
    directTotal,
    overheadPercent:      overheadPct,
    overheadAmount,
    consultingFee,
    projectManagementFee,
    contingencyAmount,
    taxAmount,
    grandTotal,
  };
}
