/**
 * Server-side helper: assemble InvoiceDocData (the shape both generators consume)
 * from a stored Invoice record + its project + the user's company settings.
 */
import {
  buildInvoiceRows, basisCaption, resolveAmountDue,
  type InvoiceSnapshot, type InvoiceParty,
} from '@/lib/invoice';
import type { InvoiceDocData, InvoiceCompanyInfo } from '@/lib/generate-invoice-pdf';

export interface StoredInvoice {
  invoiceNumber: string;
  paymentBasis:  string;
  detail:        string;
  poNumber?:     string | null;
  salesperson?:  string | null;
  terms?:        string | null;
  issuedAt?:     Date | null;
  snapshot:      unknown;
  billTo?:       unknown;
  shipTo?:       unknown;
}

export interface UserCompanySettings {
  companyName?:    string | null;
  companyTagline?: string | null;
  companyAddress?: string | null;
  companyPhone?:   string | null;
  companyWebsite?: string | null;
  logoUrl?:        string | null;
}

export function buildInvoiceDocData(
  invoice:     StoredInvoice,
  documentCode: string | null,
): InvoiceDocData {
  const snap = invoice.snapshot as InvoiceSnapshot;
  const detail = (invoice.detail === 'summary' ? 'summary' : 'line-items') as InvoiceSnapshot['detail'];
  const basis  = (invoice.paymentBasis === 'consulting-pm' ? 'consulting-pm' : 'direct-total') as InvoiceSnapshot['paymentBasis'];

  const applyDownPayment = Number(snap.downPaymentApplied ?? 0) > 0;
  const rows     = buildInvoiceRows(snap.schedule, detail, basis, applyDownPayment);
  const totalDue = resolveAmountDue(snap.schedule, basis, applyDownPayment);
  const subtotal = totalDue;   // no separate shipping; subtotal == billed amount

  const date = (invoice.issuedAt ? new Date(invoice.issuedAt) : new Date())
    .toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return {
    invoiceNumber: invoice.invoiceNumber,
    documentCode,
    date,
    poNumber:    invoice.poNumber ?? null,
    salesperson: invoice.salesperson ?? null,
    terms:       invoice.terms ?? null,
    shippedVia:  null,
    fobPoint:    null,
    billTo:      (invoice.billTo as InvoiceParty | null) ?? { name: '', address: '' },
    shipTo:      (invoice.shipTo as InvoiceParty | null) ?? null,
    rows,
    subtotal,
    shippingHandling: null,
    totalDue,
    basisCaption: basisCaption(basis),
  };
}

export function companyFromSettings(s: UserCompanySettings | null): InvoiceCompanyInfo {
  return {
    companyName:    s?.companyName ?? null,
    companyTagline: s?.companyTagline ?? null,
    companyAddress: s?.companyAddress ?? null,
    companyPhone:   s?.companyPhone ?? null,
    companyWebsite: s?.companyWebsite ?? null,
    logoUrl:        s?.logoUrl ?? null,
    payableTo:      s?.companyName ?? null,
  };
}
