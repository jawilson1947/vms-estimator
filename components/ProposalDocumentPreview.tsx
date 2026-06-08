'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { CostBreakdownTable, type CostItem, type FeeSummaryData } from './CostBreakdownTable';
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
  validUntil:      string;
  date:            string;
  companyName:     string;
  companyTagline:  string;
  logoUrl?:        string | null;
  companyPhone?:   string | null;
  companyAddress?: string | null;
  companyWebsite?: string | null;
  costs:           CostItem[];
  feeSummary:      FeeSummaryData | null;
  onClose:         () => void;
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
  costBreakdown:      'Investment Summary',
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

export function ProposalDocumentPreview({
  content, templateId, projectName, customerName, projectManager,
  validUntil, date, companyName, companyTagline,
  logoUrl, companyPhone, companyAddress, companyWebsite,
  projectNumber, siteName, costs, feeSummary, onClose,
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
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable paper area */}
      <div className="flex-1 overflow-y-auto bg-gray-200 py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-0">

          {/* ── Cover page — white centered layout ─────────────────────────── */}
          <div className="rounded-t-lg shadow-xl overflow-hidden bg-white" style={{ padding: '48px 48px 36px' }}>

            {/* Logo */}
            {logoUrl && (
              <div style={{ ...center, marginBottom: 16 }}>
                <img src={logoUrl} alt={companyName} style={{ maxHeight: 60, maxWidth: 200, objectFit: 'contain' }} />
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

            {/* Investment total */}
            {feeSummary && (
              <>
                <Rule />
                <CoverLabel text="Investment Total" color={pal.primary} />
                <div style={{ ...center, color: pal.primary, fontSize: 28, fontWeight: 700 }}>{fmt(feeSummary.grandTotal)}</div>
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
              const text    = content[key];
              const isCosts = key === 'costBreakdown';
              const hasCosts = isCosts && costs.length > 0;
              if ((!text || text.trim() === '') && !hasCosts) return null;

              return (
                <div key={key} style={{ padding: '0 48px', marginTop: 36 }}>
                  <div style={{
                    backgroundColor: pal.sectionBg, color: pal.sectionText,
                    padding: '8px 14px', fontWeight: 700, fontSize: 12,
                    letterSpacing: '.08em', textTransform: 'uppercase',
                    borderRadius: 4, marginBottom: 16,
                  }}>
                    {SECTION_LABELS[key]}
                  </div>
                  {isCosts ? (
                    <CostBreakdownTable costs={costs} feeSummary={feeSummary} templateId={templateId} />
                  ) : (
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{text}</div>
                  )}
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
