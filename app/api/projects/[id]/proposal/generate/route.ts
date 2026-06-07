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

For costBreakdown: write descriptive prose explaining the cost structure. Do NOT reproduce the raw numbers verbatim — summarise and justify them. The actual figures will be shown in a separate table.

For termsAndConditions: include standard clauses for payment terms (net 30), change orders, warranty (1 year parts and labour), limitation of liability, and proposal validity.

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
    sites:           (project.sites as Array<Record<string, unknown>>)?.map((s) => ({
      name: s.siteName, city: s.city, state: s.state,
      buildings: (s.buildings as Array<Record<string, unknown>>)?.length,
    })),
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
      sites:      { include: { buildings: { select: { id: true } } } },
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

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[proposal/generate]', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
