'use client';

import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import type { FeeSummaryData } from './CostBreakdownTable';
import { substituteCostTokens, type CostScheduleData } from '@/lib/cost-schedule';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  content:         ProposalContent;
  templateId:      string;
  projectName:     string;
  customerName:    string;
  projectManager?: string | null;
  projectNumber?:  string | null;
  siteName?:       string | null;
  buildingName?:   string | null;
  validUntil:      string;
  date:            string;
  companyName:     string;
  companyTagline:  string;
  logoUrl?:        string | null;
  companyPhone?:   string | null;
  companyAddress?: string | null;
  companyWebsite?: string | null;
  feeSummary:      FeeSummaryData | null;
  costSchedule:    CostScheduleData | null;
  onClose:         () => void;
  onExport?:        () => void;
  exporting?:       boolean;
}

// ── Template palette ──────────────────────────────────────────────────────────

const PALETTE: Record<string, { primary: string; sectionBg: string; sectionText: string }> = {
  classic:   { primary: '#1E3A5F', sectionBg: '#1E3A5F', sectionText: '#fff' },
  executive: { primary: '#1E293B', sectionBg: '#334155', sectionText: '#fff' },
  modern:    { primary: '#0F766E', sectionBg: '#0F766E', sectionText: '#fff' },
  bold:      { primary: '#4C1D95', sectionBg: '#4C1D95', sectionText: '#fff' },
  minimal:   { primary: '#111827', sectionBg: '#F3F4F6', sectionText: '#111827' },
};

const SECTION_LABELS: Partial<Record<keyof ProposalContent, string>> = {
  coverLetter:        'Introduction',
  executiveSummary:   'Executive Summary',
  scopeOfWork:        'Scope of Work',
  costBreakdown:      'Cost Schedule',
  timeline:           'Project Timeline',
  termsAndConditions: 'Terms & Conditions',
};

const SECTION_ORDER: (keyof ProposalContent)[] = [
  'coverLetter', 'executiveSummary', 'scopeOfWork',
  'costBreakdown', 'timeline', 'termsAndConditions',
];

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function Rule() {
  return <div style={{ borderBottom: '1px solid #E5E7EB', margin: '16px 48px' }} />;
}

function CoverLabel({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.10em', textAlign: 'center', marginBottom: 8 }}>
      {text}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export function ProposalDocumentPreview({
  content, templateId, projectName, customerName, projectManager,
  validUntil, date, companyName, companyTagline,
  logoUrl, companyPhone, companyAddress, companyWebsite,
  projectNumber, siteName, buildingName, feeSummary, costSchedule, onClose, onExport, exporting,
}: Props) {
  const pal = PALETTE[templateId] ?? PALETTE.classic;

  const projectSummary = content.executiveSummary
    ? (content.executiveSummary.split(/\n\n+/).find(p => p.trim()) ?? '').trim().slice(0, 400)
    : '';

  const addressLines = companyAddress?.split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, 3) ?? [];
  const phoneWeb     = [companyPhone, companyWebsite].filter(Boolean).join('   |   ');

  const center: React.CSSProperties = { textAlign: 'center' };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" style={{ backdropFilter: 'blur(2px)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">Document Preview</span>
          <span className="text-xs text-gray-400 capitalize">{templateId} template</span>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <button
              onClick={onExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exporting ? 'Generating…' : 'Export Document'}
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable paper area */}
      <div className="flex-1 overflow-y-auto bg-gray-200 py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-0">

          {/* ── Cover page — white centered layout ─────────────────────────── */}
          <div className="rounded-t-lg shadow-xl overflow-hidden bg-white" style={{ padding: '48px 48px 36px' }}>

            {/* Logo */}
            {logoUrl && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <img src={logoUrl} alt={companyName} style={{ maxHeight: 64, maxWidth: 220, objectFit: 'contain' }} />
              </div>
            )}

            {/* Company block */}
            <div style={{ ...center, color: pal.primary, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{companyName}</div>
            {companyTagline && <div style={{ ...center, color: '#6B7280', fontSize: 12, marginBottom: 4 }}>{companyTagline}</div>}
            {addressLines.map((line, i) => (
              <div key={i} style={{ ...center, color: '#9CA3AF', fontSize: 11, marginBottom: 2 }}>{line}</div>
            ))}
            {phoneWeb && <div style={{ ...center, color: '#9CA3AF', fontSize: 11, marginBottom: 4 }}>{phoneWeb}</div>}

            <Rule />

            {/* Proposal section */}
            <CoverLabel text="Proposal" color={pal.primary} />
            <div style={{ ...center, color: '#111827', fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>{customerName}</div>
            {siteName && <div style={{ ...center, color: '#374151', fontSize: 16, marginBottom: 6 }}>{siteName}</div>}
            <div style={{ ...center, color: '#111827', fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{projectName}</div>
            {buildingName && <div style={{ ...center, color: '#6B7280', fontSize: 12, marginBottom: 4 }}>{buildingName}</div>}
            {projectNumber && <div style={{ ...center, color: '#6B7280', fontSize: 12, marginBottom: 4 }}>Project No. {projectNumber}</div>}

            <Rule />

            {/* Prepared for */}
            <CoverLabel text="Prepared for:" color={pal.primary} />
            <div style={{ ...center, color: '#111827', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{projectManager ?? '—'}</div>

            {/* Project summary */}
            {projectSummary && (
              <>
                <Rule />
                <CoverLabel text="Project Summary" color={pal.primary} />
                <div style={{ ...center, color: '#6B7280', fontSize: 12, lineHeight: 1.6, maxWidth: 480, margin: '0 auto 4px' }}>{projectSummary}</div>
              </>
            )}

            <Rule />

            {/* Date */}
            <CoverLabel text="Date" color={pal.primary} />
            <div style={{ ...center, color: '#111827', fontSize: 13, marginBottom: 2 }}>{date}</div>
            <div style={{ ...center, color: '#6B7280', fontSize: 12, marginBottom: 4 }}>Valid Until: {validUntil}</div>

            {/* Investment total — prefer live costSchedule over stale feeSummary */}
            {(costSchedule || feeSummary) && (
              <>
                <Rule />
                <CoverLabel text="Investment Total" color={pal.primary} />
                <div style={{ ...center, color: pal.primary, fontSize: 28, fontWeight: 700 }}>
                  {fmt(costSchedule ? costSchedule.grandTotal : feeSummary!.grandTotal)}
                </div>
              </>
            )}

            {/* Confidentiality */}
            <Rule />
            <CoverLabel text="Confidentiality Statement" color={pal.primary} />
            <div style={{ ...center, color: '#9CA3AF', fontSize: 10, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
              This proposal contains confidential and proprietary information intended solely for the use of the named recipient.
              No part of this document may be reproduced, distributed, or disclosed without the written consent of the principal investigator.
            </div>
          </div>

          {/* ── Content sections ───────────────────────────────────────────── */}
          <div className="bg-white shadow-xl rounded-b-lg overflow-hidden pb-10">
            {SECTION_ORDER.map(key => {
              const sectionHeadingEl = (
                <div style={{
                  backgroundColor: pal.sectionBg, color: pal.sectionText,
                  padding: '8px 14px', fontWeight: 700, fontSize: 12,
                  letterSpacing: '.08em', textTransform: 'uppercase',
                  borderRadius: 4, marginBottom: 16,
                }}>
                  {SECTION_LABELS[key]}
                </div>
              );

              // Cost Schedule — always programmatic, ignores content[key]
              if (key === 'costBreakdown') {
                if (!costSchedule || costSchedule.groups.length === 0) return null;
                const thCell: React.CSSProperties = {
                  padding: '5px 6px', fontSize: 10, fontWeight: 700,
                  backgroundColor: pal.sectionBg, color: pal.sectionText,
                  textAlign: 'left', borderBottom: '1px solid #E5E7EB',
                };
                const thR: React.CSSProperties = { ...thCell, textAlign: 'right' };
                const tdCell: React.CSSProperties = { padding: '4px 6px', fontSize: 10, color: '#374151', verticalAlign: 'top' };
                const tdR: React.CSSProperties    = { ...tdCell, textAlign: 'right' };

                let prevCat = '';
                const bodyRows: React.ReactNode[] = [];
                costSchedule.groups.forEach((g, i) => {
                  if (g.category !== prevCat) {
                    bodyRows.push(
                      <tr key={`cat-${i}`}>
                        <td colSpan={6} style={{ padding: '4px 6px', fontSize: 10, fontWeight: 700, color: pal.sectionBg, backgroundColor: '#F0F4F8' }}>
                          {g.category}
                        </td>
                      </tr>
                    );
                    prevCat = g.category;
                  }
                  const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
                  bodyRows.push(
                    <tr key={i} style={{ backgroundColor: rowBg }}>
                      <td style={tdCell}></td>
                      <td style={tdCell}>{g.description}</td>
                      <td style={tdR}>{g.quantity}</td>
                      <td style={tdR}>{fmtUSD(g.unitCost)}</td>
                      <td style={tdR}>{g.markupPercent > 0 ? `${g.markupPercent}%` : '—'}</td>
                      <td style={tdR}>{fmtUSD(g.lineTotal)}</td>
                    </tr>
                  );
                });

                const feeRows: [string, number][] = [
                  ['Direct Cost Total',                                       costSchedule.directTotal],
                  // Down payment renders as a credit immediately below the direct total
                  ...(costSchedule.downPayment > 0
                    ? [['Less: Down Payment (Credit)', -costSchedule.downPayment]]
                    : []),
                  [`Overhead (${costSchedule.overheadPercent.toFixed(1)}%)`,  costSchedule.overheadAmount],
                  ['Consulting Fee',                                           costSchedule.consultingFee],
                  ['Project Management Fee',                                   costSchedule.projectManagementFee],
                  ['Contingency',                                              costSchedule.contingencyAmount],
                  ['Tax',                                                      costSchedule.taxAmount],
                ].filter(([, v]) => (v as number) !== 0) as [string, number][];

                return (
                  <div key={key} style={{ padding: '0 48px', marginTop: 36 }}>
                    {sectionHeadingEl}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thCell, width: '12%' }}>Category</th>
                          <th style={{ ...thCell, width: '38%' }}>Description</th>
                          <th style={{ ...thR,    width: '6%'  }}>Qty</th>
                          <th style={{ ...thR,    width: '14%' }}>Unit Cost</th>
                          <th style={{ ...thR,    width: '8%'  }}>Markup</th>
                          <th style={{ ...thR,    width: '14%' }}>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>{bodyRows}</tbody>
                      <tfoot>
                        {feeRows.map(([label, val]) => (
                          <tr key={label}>
                            <td colSpan={5} style={{ ...tdR, paddingTop: 5, color: val < 0 ? '#DC2626' : '#6B7280', fontStyle: 'italic' }}>{label}</td>
                            <td style={{ ...tdR, paddingTop: 5, color: val < 0 ? '#DC2626' : undefined }}>{fmtUSD(val)}</td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: pal.sectionBg }}>
                          <td colSpan={5} style={{ ...tdR, color: '#fff', fontWeight: 700, padding: '6px', fontSize: 11 }}>GRAND TOTAL</td>
                          <td style={{ ...tdR, color: '#fff', fontWeight: 700, padding: '6px', fontSize: 11 }}>{fmtUSD(costSchedule.grandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              }

              // Regular text sections
              const text = costSchedule
                ? substituteCostTokens(content[key] ?? '', costSchedule)
                : content[key];
              if (!text || text.trim() === '') return null;
              return (
                <div key={key} style={{ padding: '0 48px', marginTop: 36 }}>
                  {sectionHeadingEl}
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{text}</div>
                </div>
              );
            })}

            {/* Signatory */}
            <div style={{ padding: '36px 48px 0' }}>
              <div style={{
                backgroundColor: pal.sectionBg, color: pal.sectionText,
                padding: '8px 14px', fontWeight: 700, fontSize: 12,
                letterSpacing: '.08em', textTransform: 'uppercase',
                borderRadius: 4, marginBottom: 16,
              }}>
                Acceptance of Proposal
              </div>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 24 }}>
                The undersigned hereby accepts the terms, scope, and pricing outlined in this proposal and authorizes commencement of the described work.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
                {['Client', 'Vendor'].map(party => (
                  <div key={party}>
                    <div style={{ color: pal.primary, fontWeight: 700, fontSize: 12, marginBottom: 16 }}>{party}</div>
                    {['Signature', 'Printed Name', 'Title', 'Date'].map(field => (
                      <div key={field} style={{ marginBottom: 20 }}>
                        <div style={{ borderBottom: '1px solid #D1D5DB', marginBottom: 4, height: 24 }} />
                        <div style={{ color: '#9CA3AF', fontSize: 10 }}>{field}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
