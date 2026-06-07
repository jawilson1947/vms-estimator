'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { CostBreakdownTable, type CostItem, type FeeSummaryData } from './CostBreakdownTable';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  content:        ProposalContent;
  templateId:     string;
  projectName:    string;
  customerName:   string;
  projectManager?: string | null;
  projectNumber?: string | null;
  siteName?: string | null;
  validUntil:     string;
  date:           string;
  companyName:    string;
  companyTagline: string;
  logoUrl?:       string | null;
  companyPhone?:  string | null;
  companyAddress?: string | null;
  companyWebsite?: string | null;
  costs:          CostItem[];
  feeSummary:     FeeSummaryData | null;
  onClose:        () => void;
}

// ── Template palette ──────────────────────────────────────────────────────────

const PALETTE: Record<string, {
  coverBg: string; coverText: string; coverSub: string;
  accent: string;
  sectionBg: string; sectionText: string;
}> = {
  classic:   { coverBg:'#1E3A5F', coverText:'#fff', coverSub:'#93C5FD', accent:'#2563EB', sectionBg:'#1E3A5F', sectionText:'#fff' },
  executive: { coverBg:'#1E293B', coverText:'#fff', coverSub:'#94A3B8', accent:'#475569', sectionBg:'#334155', sectionText:'#fff' },
  modern:    { coverBg:'#0F766E', coverText:'#fff', coverSub:'#99F6E4', accent:'#0D9488', sectionBg:'#0F766E', sectionText:'#fff' },
  bold:      { coverBg:'#4C1D95', coverText:'#fff', coverSub:'#C4B5FD', accent:'#7C3AED', sectionBg:'#4C1D95', sectionText:'#fff' },
  minimal:   { coverBg:'#F3F4F6', coverText:'#111827', coverSub:'#6B7280', accent:'#374151', sectionBg:'#F3F4F6', sectionText:'#111827' },
};

const SECTION_LABELS: Partial<Record<keyof ProposalContent, string>> = {
  coverLetter:        'Cover Letter',
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

// ── Component ─────────────────────────────────────────────────────────────────

export function ProposalDocumentPreview({
  content, templateId, projectName, customerName, projectManager,
  validUntil, date, companyName, companyTagline,
  logoUrl, companyPhone, companyAddress, companyWebsite,
  projectNumber, siteName, costs, feeSummary, onClose,
}: Props) {
  const pal = PALETTE[templateId] ?? PALETTE.classic;
  const contactParts = [companyPhone, companyWebsite, companyAddress?.replace(/\n/g, ', ')]
    .filter(Boolean).join('   ·   ');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex flex-col"
      style={{ backdropFilter: 'blur(2px)' }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">Document Preview</span>
          <span className="text-xs text-gray-400 capitalize">{templateId} template</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable paper area */}
      <div className="flex-1 overflow-y-auto bg-gray-200 py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-0">

          {/* ── Cover page ─────────────────────────────────────────────────── */}
          <div
            className="rounded-t-lg shadow-xl overflow-hidden"
            style={{ backgroundColor: pal.coverBg, minHeight: 340, padding: '40px 48px 36px' }}
          >
            {/* Logo */}
            {logoUrl && (
              <img src={logoUrl} alt={companyName} style={{ height: 56, objectFit: 'contain', marginBottom: 20 }} />
            )}

            {/* Company name */}
            <div style={{ color: pal.coverText, fontSize: 30, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1.1, marginBottom: 6 }}>
              {companyName}
            </div>

            {/* Tagline */}
            {companyTagline && (
              <div style={{ color: pal.coverSub, fontSize: 12, marginBottom: 4 }}>{companyTagline}</div>
            )}

            {/* Contact line */}
            {contactParts && (
              <div style={{ color: pal.coverSub, fontSize: 11, marginBottom: 0 }}>{contactParts}</div>
            )}

            {/* Divider */}
            <div style={{ borderBottom: `3px solid ${pal.accent}`, margin: '24px 0 28px' }} />

            {/* Project manager — prominent */}
            {projectManager && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: pal.coverSub, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Project Manager</div>
                <div style={{ color: pal.coverText, fontSize: 16, fontWeight: 700 }}>{projectManager}</div>
              </div>
            )}

            {/* Proposal title + project */}
            <div style={{ color: pal.coverText, fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 8 }}>
              PROPOSAL
            </div>
            <div style={{ color: pal.coverText, fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
              {projectName}{projectNumber ? ` (${projectNumber})` : ''}
            </div>
            <div style={{ color: pal.coverSub, fontSize: 14, marginBottom: 24 }}>
              {customerName}
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {([
                ['Prepared For', customerName],
                ...(siteName ? [['Project Site', siteName]] : []),
                ['Date',         date],
                ['Valid Until',  validUntil],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label}>
                  <div style={{ color: pal.coverSub, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
                  <div style={{ color: pal.coverText, fontSize: 13, marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>

            {feeSummary && (
              <div style={{ marginTop: 28, backgroundColor: pal.accent, borderRadius: 6, padding: '12px 16px', display: 'inline-block' }}>
                <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Investment Total</div>
                <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginTop: 2 }}>
                  {fmt(feeSummary.grandTotal)}
                </div>
              </div>
            )}
          </div>

          {/* ── Content sections ────────────────────────────────────────
          {/* ── Content sections ───────────────────────────────────────────── */}
          <div className="bg-white shadow-xl rounded-b-lg overflow-hidden pb-10">
            {SECTION_ORDER.map(key => {
              const text    = content[key];
              const isCosts = key === 'costBreakdown';
              const hasCosts = isCosts && costs.length > 0;
              if ((!text || text.trim() === '') && !hasCosts) return null;

              return (
                <div key={key} style={{ padding: '0 48px', marginTop: 36 }}>
                  {/* Section heading */}
                  <div style={{
                    backgroundColor: pal.sectionBg,
                    color: pal.sectionText,
                    padding: '8px 14px',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    borderRadius: 4,
                    marginBottom: 16,
                  }}>
                    {SECTION_LABELS[key]}
                  </div>

                  {/* Section body */}
                  {isCosts ? (
                    <CostBreakdownTable costs={costs} feeSummary={feeSummary} templateId={templateId} />
                  ) : (
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
