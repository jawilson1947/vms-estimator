import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateProposalPdf } from '@/lib/generate-proposal-pdf';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';
import type { ProposalCompanyInfo } from '@/lib/generate-proposal-pdf';

/**
 * POST /api/projects/[id]/proposals/preview-pdf
 * Stateless preview — generates PDF from body content without saving to DB.
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

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const [project, userSettings] = await Promise.all([
    prisma.project.findUnique({
      where:   { id: Number(id) },
      include: {
        customer:        { select: { customerName: true } },
        feeSummary:      true,
        costs:           { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
        cameraLocations: {
          orderBy: [{ floor: 'asc' }, { areaName: 'asc' }] as const,
          include: { cameraModel: { select: { manufacturer: true, model: true, cameraType: true, indoorOutdoor: true, cost: true } } },
        },
        building: { select: { buildingName: true } },
      },
    }),
    prisma.user.findUnique({
      where:  { id: userId },
      select: { companyName: true, companyTagline: true, companyAddress: true, companyPhone: true, companyWebsite: true, logoUrl: true },
    }),
  ]);

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const company: ProposalCompanyInfo = userSettings ?? {};
  const validUntilDate = validUntil ? new Date(validUntil) : null;
  const buf = await generateProposalPdf(content, project, templateId, validUntilDate, company);

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: { 'Content-Type': 'application/pdf' },
  });
}
