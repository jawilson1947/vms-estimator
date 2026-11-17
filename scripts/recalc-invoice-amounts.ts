/**
 * One-time fix (2026-11-13): recalculate invoices.amount_due now that
 * resolveAmountDue() includes Overhead for the direct-total and combined bases.
 *
 * Dry run (no changes):   npx tsx scripts/recalc-invoice-amounts.ts
 * Apply the changes:      npx tsx scripts/recalc-invoice-amounts.ts --apply
 *
 * Uses DATABASE_URL from .env. Recomputes from each invoice's frozen snapshot,
 * so it matches exactly what the PDF/Word export now prints.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { resolveAmountDue, type InvoiceSnapshot, type InvoicePaymentBasis } from '../lib/invoice';

// Standalone scripts don't get Next.js's env loading, so read DATABASE_URL
// from .env ourselves (an already-set environment variable wins).
function loadEnv(file: string) {
  const path = join(__dirname, '..', file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnv('.env');
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const prisma = new PrismaClient();
const APPLY  = process.argv.includes('--apply');

function basisOf(snap: InvoiceSnapshot, column: string): InvoicePaymentBasis {
  const b = snap.paymentBasis ?? column;
  return b === 'consulting-pm' || b === 'combined' ? b : 'direct-total';
}

async function main() {
  const invoices = await prisma.invoice.findMany({ orderBy: { id: 'asc' } });
  let changed = 0;

  for (const inv of invoices) {
    const snap = inv.snapshot as unknown as InvoiceSnapshot;
    if (!snap?.schedule) {
      console.log(`  skip #${inv.id} ${inv.invoiceNumber}: no snapshot schedule`);
      continue;
    }
    const basis   = basisOf(snap, inv.paymentBasis);
    const applyDp = basis !== 'consulting-pm' && Number(snap.downPaymentApplied ?? 0) > 0;
    const newDue  = Math.round(resolveAmountDue(snap.schedule, basis, applyDp) * 100) / 100;
    const oldDue  = Number(inv.amountDue);
    if (Math.abs(newDue - oldDue) < 0.005) continue;

    changed++;
    console.log(`  #${inv.id} ${inv.invoiceNumber} [${basis}]  ${oldDue.toFixed(2)} -> ${newDue.toFixed(2)}`);
    if (APPLY) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          amountDue: new Prisma.Decimal(newDue.toFixed(2)),
          snapshot:  { ...snap, amountDue: newDue } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  console.log(`\n${invoices.length} invoice(s) checked, ${changed} need updating.` +
    (APPLY ? ' Updated.' : changed ? ' Dry run - re-run with --apply to save.' : ''));
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
