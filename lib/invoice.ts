/**
 * Shared invoice logic — usable both server-side (generators / routes) and
 * client-side (modal preview). No Node.js or Prisma imports.
 *
 * All dollar figures originate from `buildCostSchedule()` in lib/cost-schedule.ts
 * so an invoice can never disagree with the proposal's cost schedule.
 */
import type { CostScheduleData } from '@/lib/cost-schedule';

export type InvoiceDetail       = 'line-items' | 'summary';
export type InvoicePaymentBasis = 'direct-total' | 'consulting-pm' | 'combined';

export interface InvoiceParty {
  name?:    string | null;
  address?: string | null;   // multi-line address (newlines preserved)
}

/** One printed row of the invoice line-item table. */
export interface InvoiceRow {
  quantity:    string;   // pre-formatted (e.g. "3", "10hrs", or "" when N/A)
  description: string;
  unitPrice:   number | null;  // null → blank cell
  amount:      number;
}

/** Frozen financial snapshot stored on the Invoice record at save time. */
export interface InvoiceSnapshot {
  schedule:     CostScheduleData;
  detail:       InvoiceDetail;
  paymentBasis: InvoicePaymentBasis;
  amountDue:    number;
  /** Whether tax is included in the billed amount (only for direct-total). */
  taxIncluded:  boolean;
  /** Down-payment credit applied to this invoice (0/absent = none; direct-total only). */
  downPaymentApplied?: number;
}

export function usd(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

/** Human caption explaining which basis produced the Total Due. */
export function basisCaption(basis: InvoicePaymentBasis): string {
  if (basis === 'direct-total') return 'Direct equipment & labor total';
  if (basis === 'combined')     return 'Direct total plus consulting & project management fees';
  return 'Remaining consulting + project management fee';
}

/** Resolve the billed amount for the chosen payment basis. */
export function resolveAmountDue(
  schedule: CostScheduleData,
  basis:    InvoicePaymentBasis,
  applyDownPayment = false,
): number {
  const fees = schedule.consultingFee + schedule.projectManagementFee;
  if (basis === 'consulting-pm') return fees;
  // direct-total / combined: bill the direct line-item total,
  // optionally reduced by the project's down-payment credit.
  const dp = applyDownPayment ? Number(schedule.downPayment ?? 0) : 0;
  const direct = schedule.directTotal - dp;
  return basis === 'combined' ? direct + fees : direct;
}

/**
 * Build the printed line-item rows. Output depends on BOTH the level of detail
 * and the payment basis:
 *
 *  - direct-total + line-items → one row per cost-schedule group
 *  - direct-total + summary    → one row per category (rolled up)
 *  - consulting-pm + line-items→ Consulting Fee + Project Management Fee rows
 *  - consulting-pm + summary   → single combined services row
 *  - combined                  → direct rows (per detail) followed by the fee rows
 */
export function buildInvoiceRows(
  schedule: CostScheduleData,
  detail:   InvoiceDetail,
  basis:    InvoicePaymentBasis,
  applyDownPayment = false,
): InvoiceRow[] {
  const feeRows = (): InvoiceRow[] => {
    const consulting = schedule.consultingFee;
    const pm         = schedule.projectManagementFee;
    if (detail === 'summary') {
      return [{
        quantity:    '',
        description: 'Consulting & Project Management Services',
        unitPrice:   null,
        amount:      consulting + pm,
      }];
    }
    return [
      { quantity: '', description: 'Consulting Fee',         unitPrice: null, amount: consulting },
      { quantity: '', description: 'Project Management Fee', unitPrice: null, amount: pm },
    ];
  };

  if (basis === 'consulting-pm') return feeRows();

  // ── direct-total / combined ──────────────────────────────────────────────
  let rows: InvoiceRow[];
  if (detail === 'summary') {
    const byCategory = new Map<string, number>();
    for (const g of schedule.groups) {
      byCategory.set(g.category, (byCategory.get(g.category) ?? 0) + g.lineTotal);
    }
    rows = Array.from(byCategory, ([category, amount]) => ({
      quantity:    '',
      description: category,
      unitPrice:   null,
      amount,
    }));
  } else {
    // line-items: one row per group; unit price is the effective marked-up price
    // so quantity × unitPrice reconciles with the amount.
    rows = schedule.groups.map(g => ({
      quantity:    String(g.quantity),
      description: g.description || g.category,
      unitPrice:   g.quantity > 0 ? g.lineTotal / g.quantity : g.lineTotal,
      amount:      g.lineTotal,
    }));
  }

  // Combined: append the consulting + PM fee rows after the direct rows.
  if (basis === 'combined') rows.push(...feeRows());

  // Down-payment credit row so the printed rows reconcile with the Total Due.
  const dp = Number(schedule.downPayment ?? 0);
  if (applyDownPayment && dp > 0) {
    rows.push({
      quantity:    '',
      description: 'Less: Down Payment (Credit)',
      unitPrice:   null,
      amount:      -dp,
    });
  }
  return rows;
}

/** Build the complete frozen snapshot for storage. */
export function buildInvoiceSnapshot(
  schedule: CostScheduleData,
  detail:   InvoiceDetail,
  basis:    InvoicePaymentBasis,
  applyDownPayment = false,
): InvoiceSnapshot {
  const applied = basis !== 'consulting-pm' && applyDownPayment
    ? Number(schedule.downPayment ?? 0)
    : 0;
  return {
    schedule,
    detail,
    paymentBasis: basis,
    amountDue:    resolveAmountDue(schedule, basis, applied > 0),
    taxIncluded:  false,
    downPaymentApplied: applied,
  };
}

/** Derive the next per-project invoice number from the project number + sequence. */
export function buildInvoiceNumber(projectNumber: string | null | undefined, sequence: number): string {
  const seq = String(sequence).padStart(3, '0');
  const base = (projectNumber ?? '').trim();
  return base ? `${base}-${seq}` : `INV-${seq}`;
}
