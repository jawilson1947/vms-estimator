import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { guardProjectRead } from '@/lib/project-access';

// GET /api/projects/[id]/invoices/[invoiceId] — full invoice (with snapshot)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, invoiceId } = await params;
  const denied = await guardProjectRead(Number(id));
  if (denied) return denied;

  const invoice = await prisma.invoice.findUnique({ where: { id: Number(invoiceId) } });
  if (!invoice || invoice.projectId !== Number(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(invoice);
}

// PATCH /api/projects/[id]/invoices/[invoiceId] — status + editable header fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invoiceId } = await params;
  const body = await req.json();
  const { status, invoiceNumber, poNumber, salesperson, terms, issuedAt } = body;

  const validStatuses = ['draft', 'sent', 'paid', 'void'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const updated = await prisma.invoice.update({
    where: { id: Number(invoiceId) },
    data: {
      ...(status        !== undefined && { status }),
      ...(invoiceNumber !== undefined && { invoiceNumber }),
      ...(poNumber      !== undefined && { poNumber }),
      ...(salesperson   !== undefined && { salesperson }),
      ...(terms         !== undefined && { terms }),
      ...(issuedAt      !== undefined && { issuedAt: issuedAt ? new Date(issuedAt) : null }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/projects/[id]/invoices/[invoiceId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invoiceId } = await params;
  await prisma.invoice.delete({ where: { id: Number(invoiceId) } });
  return new NextResponse(null, { status: 204 });
}
