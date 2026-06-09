import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ProposalTone = 'professional' | 'consultative' | 'friendly';

export interface ProposalContent {
  coverLetter:        string;
  executiveSummary:   string;
  scopeOfWork:        string;
  costBreakdown:      string;
  timeline:           string;
  termsAndConditions: string;
}

export interface GenerateRequest {
  tone:            ProposalTone;
  includeSections: (keyof ProposalContent)[];
  additionalContext?: string;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function buildCostBreakdownText(project: Awaited<ReturnType<typeof prisma.project.findUnique>> & object): string {
  const costs      = (project as Record<string, unknown>).costs as Array<Record<string, unknown>>;
  const feeSummary = (project as Record<string, unknown>).feeSummary as Record<string, unknown> | null;

  if (!costs?.length) return '';

  // Group by category
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const c of costs) {
    const cat = (c.category as Record<string, unknown>)?.name as string ?? 'Uncategorised';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(c);
  }

  const lines: string[] = [];

  for (const [catName, items] of grouped) {
    lines.push(catName);
    const subtotal = items.reduce((s, c) => s + Number(c.lineTotal ?? 0), 0);
    for (const c of items) {
      const desc       = (c.description as string | null) ?? '—';
      const qty        = Number(c.quantity);
      const unit       = Number(c.unitCost);
      const markup     = Number(c.markupPercent ?? 0);
      const displayUnit = markup > 0 ? unit * (1 + markup / 100) : unit;
      const tot        = Number(c.lineTotal ?? 0);
      lines.push(`  ${desc}  (${qty} × ${fmt(displayUnit)})  ${fmt(tot)}`);
    }
    lines.push(`  Subtotal: ${fmt(subtotal)}`);
    lines.push('');
  }

  if (feeSummary) {
    const fs = feeSummary;
    const feeRows: [string, number][] = [
      ['Direct Cost Total',      Number(fs.directCostTotal)],
      [`Overhead (${Number(fs.overheadPercent).toFixed(1)}%)`, Number(fs.overheadAmount)],
      ['Consulting Fee',         Number(fs.consultingFee)],
      ['Project Management Fee', Number(fs.projectManagementFee)],
      ['Contingency',            Number(fs.contingencyAmount)],
      ['Tax',                    Number(fs.taxAmount)],
    ].filter(([, v]) => (v as number) > 0) as [string, number][];

    for (const [label, val] of feeRows) lines.push(`${label}: ${fmt(val)}`);
    lines.push('');
    lines.push(`Grand Total: ${fmt(Number(fs.grandTotal))}`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(tone: ProposalTone): string {
  const toneGuide = {
    professional:  'formal, precise, and authoritative. Use industry terminology. Avoid contractions.',
    consultative:  'collaborative and advisory. Emphasize partnership, shared goals, and your expertise as a trusted advisor.',
    friendly:      'warm, approachable, and conversational. Use plain language and a positive, encouraging tone.',
  }[tone];

  return `You are a professional proposal writer for a security systems integration company that installs video surveillance and camera management systems.

Your writing style should be: ${toneGuide}

You will receive project details in JSON and must return a JSON object with proposal sections. Each section should be 2–4 paragraphs of polished, client-ready prose. Do not use markdown formatting — plain paragraphs only, separated by two newlines.

Always return valid JSON matching exactly this shape:
{
  "coverLetter": "...",
  "executiveSummary": "...",
  "scopeOfWork": "...",
  "costBreakdown": "...",
  "timeline": "...",
  "termsAndConditions": "..."
}

If a section key is absent from the includeSections list, set its value to an empty string "".

For scopeOfWork: the project data includes a "building" object with a name and a "cameras" array of placements. Structure the scope of work around the building — name it explicitly and describe the surveillance coverage planned. Reference specific areas and camera types where provided.

For costBreakdown: always set this field to an empty string "". The cost breakdown is generated programmatically from live project data and does not require AI content.

For termsAndConditions: include standard clauses for change orders, warranty (1 year parts and labour), limitation of liability, and proposal validity. For payment terms, use the following specific schedule: the full direct cost is due and payable prior to commencement of work; the remaining balance is due within 30 days of project completion as approved by the project manager.

Never include markdown, bullet points, or headers inside any section value.`;
}

function buildUserMessage(project: Record<string, unknown>, req: GenerateRequest): string {
  type Loc = {
    floor: string | null; areaName: string | null; mountingLocation: string | null;
    coveragePurpose: string | null;
    cameraModel: { manufacturer: string | null; model: string | null; cameraType: string | null; indoorOutdoor: string | null } | null;
  };
  type Bldg = { buildingName: string; site: { siteName: string; city: string | null; state: string | null } };

  const building = project.building as (Bldg & { id: number }) | null;
  const locs = (project.cameraLocations ?? []) as Loc[];

  return JSON.stringify({
    projectName:     project.projectName,
    projectNumber:   project.projectNumber,
    customer:        (project.customer as Record<string, unknown>)?.customerName,
    projectManager:  project.projectManager,
    startDate:       project.startDate,
    completionDate:  project.completionDate,
    status:          project.projectStatus,
    notes:           project.notes,
    building: building ? {
      name:        building.buildingName,
      site:        building.site?.siteName,
      city:        building.site?.city,
      state:       building.site?.state,
      cameraCount: locs.length,
      cameras: locs.map(l => ({
        area:             [l.floor, l.areaName].filter(Boolean).join(' – ') || undefined,
        mountingLocation: l.mountingLocation || undefined,
        coveragePurpose:  l.coveragePurpose  || undefined,
        model:            l.cameraModel ? [l.cameraModel.manufacturer, l.cameraModel.model].filter(Boolean).join(' ') : undefined,
        type:             l.cameraModel?.cameraType    || undefined,
        environment:      l.cameraModel?.indoorOutdoor || undefined,
      })),
    } : null,
    costSummary: project.feeSummary ? {
      directCosts:         Number((project.feeSummary as Record<string, unknown>).directCostTotal),
      overhead:            Number((project.feeSummary as Record<string, unknown>).overheadAmount),
      consultingFee:       Number((project.feeSummary as Record<string, unknown>).consultingFee),
      projectManagementFee:Number((project.feeSummary as Record<string, unknown>).projectManagementFee),
      contingency:         Number((project.feeSummary as Record<string, unknown>).contingencyAmount),
      tax:                 Number((project.feeSummary as Record<string, unknown>).taxAmount),
      grandTotal:          Number((project.feeSummary as Record<string, unknown>).grandTotal),
    } : null,
    costLineItems: (project.costs as Array<Record<string, unknown>>)?.map((c) => ({
      category:    (c.category as Record<string, unknown>)?.name,
      description: c.description,
      quantity:    Number(c.quantity),
      unitCost:    Number(c.unitCost),
      lineTotal:   Number(c.lineTotal),
    })),
    includeSections: req.includeSections,
    additionalContext: req.additionalContext ?? '',
  }, null, 2);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 503 });
  }

  const { id } = await params;
  const projectId = Number(id);

  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: {
      customer:   { select: { customerName: true } },
      building: {
        include: {
          site: { select: { siteName: true, city: true, state: true } },
        },
      },
      cameraLocations: {
        orderBy: [{ floor: 'asc' }, { areaName: 'asc' }],
        select: {
          floor: true,
          areaName: true,
          mountingLocation: true,
          coveragePurpose: true,
          cameraModel: {
            select: { manufacturer: true, model: true, cameraType: true, indoorOutdoor: true },
          },
        },
      },
      costs:      { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
      feeSummary: true,
    },
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body: GenerateRequest = await req.json();
  const { tone = 'professional', includeSections, additionalContext } = body;

  const allSections: (keyof ProposalContent)[] = [
    'coverLetter', 'executiveSummary', 'scopeOfWork',
    'costBreakdown', 'timeline', 'termsAndConditions',
  ];
  const sections = includeSections?.length ? includeSections : allSections;

  try {
    const response = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  16000,
      system:      buildSystemPrompt(tone),
      tools: [{
        name:        'write_proposal',
        description: 'Write all sections of a security systems proposal.',
        input_schema: {
          type: 'object' as const,
          properties: {
            coverLetter:        { type: 'string', description: '2–4 paragraphs, plain text, no markdown.' },
            executiveSummary:   { type: 'string', description: '2–4 paragraphs, plain text, no markdown.' },
            scopeOfWork:        { type: 'string', description: '2–4 paragraphs per building, plain text, no markdown.' },
            costBreakdown:      { type: 'string', description: 'Always set to empty string "".' },
            timeline:           { type: 'string', description: '2–4 paragraphs, plain text, no markdown.' },
            termsAndConditions: { type: 'string', description: 'Standard clauses, plain text, no markdown.' },
          },
          required: ['coverLetter', 'executiveSummary', 'scopeOfWork', 'costBreakdown', 'timeline', 'termsAndConditions'],
        },
      }],
      tool_choice: { type: 'tool' as const, name: 'write_proposal' },
      messages: [{
        role:    'user',
        content: buildUserMessage(project as Record<string, unknown>, { tone, includeSections: sections, additionalContext }),
      }],
    });

    // With tool_choice forced, the response is always a tool_use block
    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      console.error('[proposal/generate] No tool_use block in response', response.content);
      return NextResponse.json({ error: 'AI did not return a structured response.' }, { status: 502 });
    }

    const content = toolBlock.input as ProposalContent;

    // Always inject programmatic cost breakdown when the section was requested
    if (sections.includes('costBreakdown')) {
      content.costBreakdown = buildCostBreakdownText(project as Parameters<typeof buildCostBreakdownText>[0]);
    }

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[proposal/generate]', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
