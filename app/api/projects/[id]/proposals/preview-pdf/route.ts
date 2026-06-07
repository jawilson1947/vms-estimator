import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateProposalPdf } from '@/lib/generate-proposal-pdf';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';

/**
 * POST /api/projects/[id]/proposals/preview-pdf
 *
 * Stateless preview endpoint — generates a PDF from content supplied in the
 * request body without writing anything to the database. Used by the modal's
 * live PDF preview tab.
 *
 * Body: { content: ProposalContent, template?: string, validUntil?: string | null }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { content, template: templateId = 'classic', validUntil } = body as {
    content:     ProposalContent;
    template?:   string;
    validUntil?: string | null;
  };

  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

  const project = await prisma.project.findUnique({
    where:   { id: Number(id) },
    include: {
      customer:   { select: { customerName: true } },
      feeSummary: true,
      costs:      { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
    },
  });

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const validUntilDate = validUntil ? new Date(validUntil) : null;
  const buf = await generateProposalPdf(content, project, templateId, validUntilDate);

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: { 'Content-Type': 'application/pdf' },
  });
}
