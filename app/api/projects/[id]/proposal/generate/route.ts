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

For scopeOfWork: the project data includes a "sites" array with a "buildings" array. Each building has a name, camera count, and a list of camera placements with area, mounting location, coverage purpose, and model. Structure the scope of work by building — name each building explicitly and describe the surveillance coverage planned for it. Reference specific areas and camera types where provided.

For costBreakdown: always set this field to an empty string "". The cost breakdown is generated programmatically from live project data and does not require AI content.

For termsAndConditions: include standard clauses for change orders, warranty (1 year parts and labour), limitation of liability, and proposal validity. For payment terms, use the following specific schedule: the full direct cost is due and payable prior to commencement of work; the remaining balance is due within 30 days of project completion as approved by the project manager.

Never include markdown, bullet points, or headers inside any section value.`;
}

function buildUserMessage(project: Record<string, unknown>, req: GenerateRequest): string {
  return JSON.stringify({
    projectName:     project.projectName,
    projectNumber:   project.projectNumber,
    customer:        (project.customer as Record<string, unknown>)?.customerName,
    projectManager:  project.projectManager,
    startDate:       project.startDate,
    completionDate:  project.completionDate,
    status:          project.projectStatus,
    notes:           project.notes,
    sites: project.site ? (() => {
      type Loc = { floor: string | null; areaName: string | null; mountingLocation: string | null; coveragePurpose: string | null; cameraModel: { manufacturer: string | null; model: string | null; cameraType: string | null; indoorOutdoor: string | null } | null };
      type Bldg = { buildingName: string; locations: Loc[] };
      const s = project.site as unknown as { siteName: string; city: string | null; state: string | null; buildings: Bldg[] };
      return [{
        name:     s.siteName,
        city:     s.city,
        state:    s.state,
        buildings: (s.buildings ?? []).map(b => ({
          name:          b.buildingName,
          cameraCount:   b.locations.length,
          cameras: b.locations.map(l => ({
            area:             [l.floor, l.areaName].filter(Boolean).join(' – ') || undefined,
            mountingLocation: l.mountingLocation || undefined,
            coveragePurpose:  l.coveragePurpose  || undefined,
            model:            l.cameraModel ? [l.cameraModel.manufacturer, l.cameraModel.model].filter(Boolean).join(' ') : undefined,
            type:             l.cameraModel?.cameraType    || undefined,
            environment:      l.cameraModel?.indoorOutdoor || undefined,
          })),
        })),
      }];
    })() : [],
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
      site: {
        select: {
          siteName: true, city: true, state: true,
          buildings: {
            orderBy: { buildingName: 'asc' },
            select: {
              buildingName: true,
              locations: {
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
            },
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
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     buildSystemPrompt(tone),
      messages:   [{
        role:    'user',
        content: buildUserMessage(project as Record<string, unknown>, { tone, includeSections: sections, additionalContext }),
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let content: ProposalContent;
    try {
      content = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: text }, { status: 502 });
    }

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
