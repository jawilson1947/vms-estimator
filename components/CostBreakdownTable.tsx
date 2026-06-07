'use client';

import { Fragment } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CostItem {
  id:          number;
  description: string | null;
  quantity:    number;
  unitCost:    number;
  lineTotal:   number;
  category:    { name: string };
}

export interface FeeSummaryData {
  directCostTotal:      number;
  overheadPercent:      number;
  overheadAmount:       number;
  consultingFee:        number;
  projectManagementFee: number;
  contingencyAmount:    number;
  taxAmount:            number;
  grandTotal:           number;
}

interface Props {
  costs:      CostItem[];
  feeSummary: FeeSummaryData | null;
  templateId?: string;
}

// ── Template colour map ───────────────────────────────────────────────────────

const COLORS: Record<string, {
  hdr: string; hdrText: string;
  cat: string; catText: string;
  sub: string; subText: string;
  total: string; totalText: string;
  alt: string;
}> = {
  classic:   { hdr:'#1E3A5F', hdrText:'#fff', cat:'#E8ECF0', catText:'#1E3A5F', sub:'#EEF2FF', subText:'#1E3A5F', total:'#2563EB', totalText:'#fff', alt:'#F8FAFC' },
  executive: { hdr:'#1E293B', hdrText:'#fff', cat:'#E2E8F0', catText:'#0F172A', sub:'#F1F5F9', subText:'#0F172A', total:'#334155', totalText:'#fff', alt:'#F8FAFC' },
  modern:    { hdr:'#0F766E', hdrText:'#fff', cat:'#CCFBF1', catText:'#134E4A', sub:'#F0FDFA', subText:'#134E4A', total:'#0D9488', totalText:'#fff', alt:'#F0FDFA' },
  bold:      { hdr:'#4C1D95', hdrText:'#fff', cat:'#EDE9FE', catText:'#2E1065', sub:'#F5F3FF', subText:'#2E1065', total:'#7C3AED', totalText:'#fff', alt:'#FAF5FF' },
  minimal:   { hdr:'#374151', hdrText:'#fff', cat:'#F3F4F6', catText:'#111827', sub:'#F9FAFB', subText:'#374151', total:'#374151', totalText:'#fff', alt:'#F9FAFB' },
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CostBreakdownTable({ costs, feeSummary, templateId = 'classic' }: Props) {
  const c = COLORS[templateId] ?? COLORS.classic;

  if (!costs.length) {
    return <p className="text-sm text-gray-400 italic">No line items yet.</p>;
  }

  // Group by category
  const grouped = new Map<string, CostItem[]>();
  for (const item of costs) {
    const k = item.category.name;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(item);
  }

  const thStyle: React.CSSProperties = {
    backgroundColor: c.hdr, color: c.hdrText,
    padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600,
    borderBottom: '2px solid rgba(0,0,0,.1)',
  };
  const thR: React.CSSProperties = { ...thStyle, textAlign: 'right' };

  let rowIdx = 0;

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle}>Description</th>
            <th style={{ ...thR, width: 60 }}>Qty</th>
            <th style={{ ...thR, width: 110 }}>Unit Cost</th>
            <th style={{ ...thR, width: 120 }}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {[...grouped.entries()].map(([catName, items]) => {
            const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
            return (
              <Fragment key={catName}>
                {/* Category header */}
                <tr>
                  <td colSpan={4} style={{
                    backgroundColor: c.cat, color: c.catText,
                    padding: '7px 12px', fontWeight: 700, fontSize: 12,
                    letterSpacing: '.03em', textTransform: 'uppercase',
                    borderTop: '1px solid #E5E7EB',
                  }}>
                    {catName}
                  </td>
                </tr>

                {/* Line items */}
                {items.map(item => {
                  const bg = rowIdx++ % 2 === 0 ? '#fff' : c.alt;
                  return (
                    <tr key={item.id} style={{ backgroundColor: bg }}>
                      <td style={{ padding: '7px 12px', color: '#111827', borderBottom: '1px solid #F3F4F6' }}>
                        {item.description || '—'}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#6B7280', borderBottom: '1px solid #F3F4F6' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#6B7280', borderBottom: '1px solid #F3F4F6' }}>
                        {fmt(item.unitCost)}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#111827', borderBottom: '1px solid #F3F4F6' }}>
                        {fmt(item.lineTotal)}
                      </td>
                    </tr>
                  );
                })}

                {/* Subtotal */}
                <tr style={{ backgroundColor: c.sub }}>
                  <td colSpan={3} style={{ padding: '6px 12px', textAlign: 'right', color: c.subText, fontWeight: 600, fontSize: 12, borderBottom: '1px solid #E5E7EB' }}>
                    {catName} Subtotal
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: c.subText, fontWeight: 700, borderBottom: '1px solid #E5E7EB' }}>
                    {fmt(subtotal)}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>

        {feeSummary && (() => {
          const fs = feeSummary;
          const feeRows: [string, number][] = [
            ['Direct Cost Total',      fs.directCostTotal],
            [`Overhead (${fs.overheadPercent.toFixed(1)}%)`, fs.overheadAmount],
            ['Consulting Fee',         fs.consultingFee],
            ['Project Management Fee', fs.projectManagementFee],
            ['Contingency',            fs.contingencyAmount],
            ['Tax',                    fs.taxAmount],
          ].filter(([, v]) => (v as number) > 0) as [string, number][];

          return (
            <tfoot>
              <tr><td colSpan={4} style={{ height: 4, backgroundColor: '#F9FAFB' }} /></tr>

              {feeRows.map(([label, val]) => (
                <tr key={label} style={{ backgroundColor: '#F9FAFB' }}>
                  <td colSpan={3} style={{ padding: '5px 12px', textAlign: 'right', color: '#6B7280', fontSize: 12 }}>
                    {label}
                  </td>
                  <td style={{ padding: '5px 12px', textAlign: 'right', color: '#374151', fontSize: 12 }}>
                    {fmt(val)}
                  </td>
                </tr>
              ))}

              {/* Grand total */}
              <tr>
                <td colSpan={3} style={{
                  padding: '10px 12px', textAlign: 'right',
                  backgroundColor: c.total, color: c.totalText,
                  fontWeight: 700, fontSize: 14,
                }}>
                  Grand Total
                </td>
                <td style={{
                  padding: '10px 12px', textAlign: 'right',
                  backgroundColor: c.total, color: c.totalText,
                  fontWeight: 700, fontSize: 16,
                }}>
                  {fmt(fs.grandTotal)}
                </td>
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}
