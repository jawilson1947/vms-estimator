import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { guardProjectRead } from '@/lib/project-access';
import { generateProposalPdf } from '@/lib/generate-proposal-pdf';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';
import type { ProposalCompanyInfo } from '@/lib/generate-proposal-pdf';

// POST /api/projects/[id]/proposals/[proposalId]/pdf
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, proposalId } = await params;
  const denied = await guardProjectRead(Number(id));
  if (denied) return denied;

  // template may be sent in the body so we don't rely on stale Prisma client types
  const body = await req.json().catch(() => ({})) as { template?: string };

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const [proposal, project, userSettings] = await Promise.all([
    prisma.proposal.findUnique({ where: { id: Number(proposalId) } }),
    prisma.project.findUnique({
      where:   { id: Number(id) },
      include: {
        customer:        { select: { customerName: true } },
        feeSummary:      true,
        costs:           { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
        cameraLocations: {
          orderBy: [{ floor: 'asc' }, { areaName: 'asc' }] as const,
          include: { cameraModel: { select: { manufacturer: true, model: true, cameraType: true, indoorOutdoor: true } } },
        },
      },
    }),
    prisma.user.findUnique({
      where:  { id: userId },
      select: { companyName: true, companyTagline: true, companyAddress: true, companyPhone: true, companyWebsite: true, logoUrl: true },
    }),
  ]);

  if (!proposal || !project || proposal.projectId !== Number(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const content    = proposal.content as unknown as ProposalContent;
  const templateId = body.template ?? (proposal as { template?: string }).template ?? 'classic';
  const company: ProposalCompanyInfo = userSettings ?? {};

  const buf = await generateProposalPdf(content, project, templateId, proposal.validUntil, company);

  const slug    = project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="proposal-${slug}-${dateStr}.pdf"`,
    },
  });
}
