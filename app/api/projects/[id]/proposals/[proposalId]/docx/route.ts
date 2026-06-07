import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateProposalDocx } from '@/lib/generate-proposal-docx';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';

// POST /api/projects/[id]/proposals/[proposalId]/docx
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, proposalId } = await params;

  // template/siteName may be passed in the body to bypass stale Prisma client
  const body = await req.json().catch(() => ({})) as { template?: string; siteName?: string | null };

  const userId = Number((session.user as { id?: string | number }).id ?? 0);

  const [proposal, project, userSettings] = await Promise.all([
    prisma.proposal.findUnique({ where: { id: Number(proposalId) } }),
    prisma.project.findUnique({
      where:   { id: Number(id) },
      include: {
        customer:   { select: { customerName: true } },
        feeSummary: true,
        costs:      { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
      },
    }),
    prisma.user.findUnique({
      where:  { id: userId },
      select: {
        companyName: true, companyTagline: true, logoUrl: true,
        companyPhone: true, companyAddress: true, companyWebsite: true,
        defaultProjectManager: true,
      },
    }),
  ]);

  if (!proposal || !project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const content    = proposal.content as unknown as ProposalContent;
  const templateId = body.template
    ?? (proposal as { template?: string }).template
    ?? 'classic';

  const buf = await generateProposalDocx(
    content,
    project,
    templateId,
    proposal.validUntil,
    userSettings ?? {},
    body.siteName ?? null,
  );

  const slug    = project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="proposal-${slug}-${dateStr}.docx"`,
    },
  });
}
