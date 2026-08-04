import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildCostSchedule } from '@/lib/cost-schedule';
import { guardProjectRead } from '@/lib/project-access';
import {
  buildInvoiceSnapshot, buildInvoiceNumber,
  type InvoiceDetail, type InvoicePaymentBasis, type InvoiceParty,
} from '@/lib/invoice';

// GET /api/projects/[id]/invoices — list invoices for a project (no heavy snapshot)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const denied = await guardProjectRead(Number(id));
  if (denied) return denied;

  const invoices = await prisma.invoice.findMany({
    where:   { projectId: Number(id) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, invoiceNumber: true, sequence: true, detail: true,
      paymentBasis: true, amountDue: true, status: true, issuedAt: true,
      poNumber: true, terms: true, createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json(invoices);
}

// POST /api/projects/[id]/invoices — create a new invoice from live project costs
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json().catch(() => ({})) as {
    detail?:         InvoiceDetail;
    paymentBasis?:   InvoicePaymentBasis;
    invoiceNumber?:  string;
    billTo?:         InvoiceParty | null;
    shipTo?:         InvoiceParty | null;
    poNumber?:       string | null;
    salesperson?:    string | null;
    terms?:          string | null;
    shippedVia?:     string | null;
    fobPoint?:       string | null;
    issuedAt?:       string | null;
    applyDownPayment?: boolean;
  };

  const detail: InvoiceDetail       = body.detail === 'summary' ? 'summary' : 'line-items';
  const basis:  InvoicePaymentBasis =
    body.paymentBasis === 'consulting-pm' ? 'consulting-pm'
    : body.paymentBasis === 'combined'    ? 'combined'
    : 'direct-total';

  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: {
      customer:        { select: { customerName: true, contactName: true, billingAddress: true } },
      feeSummary:      true,
      costs:           { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
      cameraLocations: {
        orderBy: [{ floor: 'asc' }, { areaName: 'asc' }] as const,
        include: { cameraModel: { select: { manufacturer: true, model: true, cost: true } } },
      },
    },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Compute the cost schedule server-side so the billed amount is authoritative.
  const schedule = buildCostSchedule(
    project.cameraLocations as Parameters<typeof buildCostSchedule>[0],
    project.costs           as Parameters<typeof buildCostSchedule>[1],
    project.feeSummary      as Parameters<typeof buildCostSchedule>[2],
  );
  const applyDownPayment = basis !== 'consulting-pm' && body.applyDownPayment === true;
  const snapshot = buildInvoiceSnapshot(schedule, detail, basis, applyDownPayment);

  // Default Bill To from the customer record when not supplied.
  const billTo: InvoiceParty = body.billTo ?? {
    name:    [project.customer.customerName, project.customer.contactName].filter(Boolean).join(' — '),
    address: project.customer.billingAddress ?? '',
  };
  const shipTo: InvoiceParty | null = body.shipTo ?? null;

  // Sequence + number derived per-project, inside a transaction to avoid races.
  const invoice = await prisma.$transaction(async (tx) => {
    const count    = await tx.invoice.count({ where: { projectId } });
    const sequence = count + 1;
    const invoiceNumber = body.invoiceNumber?.trim()
      ? body.invoiceNumber.trim()
      : buildInvoiceNumber(project.projectNumber, sequence);
    return tx.invoice.create({
      data: {
        projectId,
        invoiceNumber,
        sequence,
        detail,
        paymentBasis: basis,
        amountDue:    snapshot.amountDue,
        snapshot:     snapshot as unknown as object,
        billTo:       billTo as unknown as object,
        shipTo:       shipTo as unknown as object | undefined,
        poNumber:     body.poNumber  || null,
        salesperson:  body.salesperson || null,
        terms:        body.terms     || 'COD',
        issuedAt:     body.issuedAt ? new Date(body.issuedAt) : new Date(),
        status:       'draft',
      },
    });
  });

  return NextResponse.json(invoice, { status: 201 });
}
