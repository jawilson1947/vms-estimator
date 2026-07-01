import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { guardProjectRead } from '@/lib/project-access';

// GET /api/projects/[id]/proposals — list all proposals for a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const denied = await guardProjectRead(Number(id));
  if (denied) return denied;
  const proposals = await prisma.proposal.findMany({
    where:   { projectId: Number(id) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, tone: true, template: true, status: true,
      validUntil: true, createdAt: true, updatedAt: true,
      // exclude heavy content from list
    },
  });

  return NextResponse.json(proposals);
}

// POST /api/projects/[id]/proposals — save a new proposal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, content, tone, template, validUntil } = body;

  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

  const proposal = await prisma.proposal.create({
    data: {
      projectId:  Number(id),
      title:      title || 'Proposal',
      content,
      tone:       tone     || 'professional',
      template:   template || 'classic',
      status:     'draft',
      validUntil: validUntil ? new Date(validUntil) : null,
    },
  });

  return NextResponse.json(proposal, { status: 201 });
}
