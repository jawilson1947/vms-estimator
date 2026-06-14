import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateInvoicePdf } from '@/lib/generate-invoice-pdf';
import { buildInvoiceDocData, companyFromSettings } from '@/lib/invoice-export';

// POST /api/projects/[id]/invoices/[invoiceId]/pdf
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, invoiceId } = await params;
  const userId = Number((session.user as { id?: string | number }).id ?? 0);

  const [invoice, project, userSettings] = await Promise.all([
    prisma.invoice.findUnique({ where: { id: Number(invoiceId) } }),
    prisma.project.findUnique({ where: { id: Number(id) }, select: { projectNumber: true, projectName: true } }),
    prisma.user.findUnique({
      where:  { id: userId },
      select: { companyName: true, companyTagline: true, companyAddress: true, companyPhone: true, companyWebsite: true, logoUrl: true },
    }),
  ]);

  if (!invoice || !project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const docData = buildInvoiceDocData(invoice, invoice.invoiceNumber);
  const buf     = await generateInvoicePdf(docData, companyFromSettings(userSettings));

  const slug = project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${slug}-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
