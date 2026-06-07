import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/projects/[id]/proposals/[proposalId] — fetch full proposal (including content)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { proposalId } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id: Number(proposalId) } });
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(proposal);
}

// PATCH /api/projects/[id]/proposals/[proposalId] — update status, title, content, or validUntil
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { proposalId } = await params;
  const body = await req.json();
  const { status, title, content, validUntil } = body;

  const validStatuses = ['draft', 'sent', 'accepted', 'rejected'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const updated = await prisma.proposal.update({
    where: { id: Number(proposalId) },
    data: {
      ...(status     !== undefined && { status }),
      ...(title      !== undefined && { title }),
      ...(content    !== undefined && { content }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/projects/[id]/proposals/[proposalId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { proposalId } = await params;
  await prisma.proposal.delete({ where: { id: Number(proposalId) } });
  return new NextResponse(null, { status: 204 });
}
