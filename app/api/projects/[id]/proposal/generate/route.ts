import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildCostSchedule } from '@/lib/cost-schedule';
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

function buildSystemPrompt(tone: ProposalTone): string {
  const toneGuide = {
    professional:  'formal, precise, and authoritative. Use industry terminology. Avoid contractions.',
    consultative:  'collaborative and advisory. Emphasize partnership, shared goals, and your expertise as a trusted advisor.',
    friendly:      'warm, approachable, and conversational. Use plain language and a positive, encouraging tone.',
  }[tone];

  return `You are a professional proposal writer for a security systems integration company that installs video surveillance and camera management systems.

Your writing style should be: ${toneGuide}

You will receive project details in JSON and must return a JSON object with proposal sections. Each section should be 2-4 paragraphs of polished, client-ready prose. Do not use markdown formatting -- plain paragraphs only, separated by two newlines.

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

For scopeOfWork: the project data includes a "cameras" array of surveyed locations. Describe the surveillance coverage planned, referencing specific areas, floors, and camera types where provided. If a building name is available, name it explicitly.

For costBreakdown: always set this field to an empty string "". The cost breakdown is generated programmatically from live project data and does not require AI content.

For termsAndConditions: include standard clauses for change orders, warranty (1 year parts and labour), limitation of liability, and proposal validity. For payment terms, use the following specific schedule: the full direct cost is due and payable prior to commencement of work; the remaining balance is due within 30 days of project completion as approved by the project manager.

CRITICAL: Never write literal dollar amounts anywhere in the proposal text. When a payment term or any sentence refers to the direct cost amount, write the exact placeholder token {{DIRECT_TOTAL}}; for the total project price, write {{GRAND_TOTAL}}. These tokens are replaced with live figures from the cost schedule when the document is produced, guaranteeing the text always matches the cost schedule table.

Never include markdown, bullet points, or headers inside any section value.`;
}

function buildUserMessage(
  project:  Record<string, unknown>,
  schedule: ReturnType<typeof buildCostSchedule>,
  req:      GenerateRequest,
): string {
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
      name: building.buildingName,
      site: building.site?.siteName,
      city: building.site?.city,
      state: building.site?.state,
    } : null,
    cameraCount: locs.length,
    cameras: locs.map(l => ({
      area:             [l.floor, l.areaName].filter(Boolean).join(' – ') || undefined,
      mountingLocation: l.mountingLocation || undefined,
      coveragePurpose:  l.coveragePurpose  || undefined,
      model:            l.cameraModel ? [l.cameraModel.manufacturer, l.cameraModel.model].filter(Boolean).join(' ') : undefined,
      type:             l.cameraModel?.cameraType    || undefined,
      environment:      l.cameraModel?.indoorOutdoor || undefined,
    })),
    // Live-computed from current line items — same source as the cost schedule table
    costSummary: {
      directCosts:          schedule.directTotal,
      overhead:             schedule.overheadAmount,
      consultingFee:        schedule.consultingFee,
      projectManagementFee: schedule.projectManagementFee,
      contingency:          schedule.contingencyAmount,
      tax:                  schedule.taxAmount,
      grandTotal:           schedule.grandTotal,
    },
    costLineItems: schedule.groups.map((g) => ({
      category:    g.category,
      description: g.description,
      quantity:    g.quantity,
      unitCost:    g.unitCost,
      lineTotal:   g.lineTotal,
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
          cameraModelId: true,
          floor: true,
          areaName: true,
          mountingLocation: true,
          coveragePurpose: true,
          cameraModel: {
            select: { manufacturer: true, model: true, cameraType: true, indoorOutdoor: true, cost: true },
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
    'timeline', 'termsAndConditions',
  ];
  const sections = includeSections?.length ? includeSections : allSections;

  // Live cost schedule — identical computation to the document generators,
  // so figures the AI sees always agree with the cost schedule table.
  const schedule = buildCostSchedule(
    project.cameraLocations as Parameters<typeof buildCostSchedule>[0],
    project.costs as unknown as Parameters<typeof buildCostSchedule>[1],
    project.feeSummary,
  );

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
            coverLetter:        { type: 'string', description: '2-4 paragraphs, plain text, no markdown.' },
            executiveSummary:   { type: 'string', description: '2-4 paragraphs, plain text, no markdown.' },
            scopeOfWork:        { type: 'string', description: '2-4 paragraphs per building, plain text, no markdown.' },
            costBreakdown:      { type: 'string', description: 'Always set to empty string "".' },
            timeline:           { type: 'string', description: '2-4 paragraphs, plain text, no markdown.' },
            termsAndConditions: { type: 'string', description: 'Standard clauses, plain text, no markdown.' },
          },
          required: ['coverLetter', 'executiveSummary', 'scopeOfWork', 'costBreakdown', 'timeline', 'termsAndConditions'],
        },
      }],
      tool_choice: { type: 'tool' as const, name: 'write_proposal' },
      messages: [{
        role:    'user',
        content: buildUserMessage(project as Record<string, unknown>, schedule, { tone, includeSections: sections, additionalContext }),
      }],
    });

    // With tool_choice forced, the response is always a tool_use block
    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      console.error('[proposal/generate] No tool_use block in response', response.content);
      return NextResponse.json({ error: 'AI did not return a structured response.' }, { status: 502 });
    }

    const content = toolBlock.input as ProposalContent;

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[proposal/generate]', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
