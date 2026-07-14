'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  XMarkIcon, ArrowRightIcon, ArrowLeftIcon,
  SparklesIcon, ArrowDownTrayIcon, ClipboardDocumentIcon,
  PencilSquareIcon, CheckIcon, ArrowPathIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import type { ProposalContent } from '@/app/api/projects/[id]/proposal/generate/route';
import type { FeeSummaryData } from '@/components/CostBreakdownTable';
import { ProposalDocumentPreview } from '@/components/ProposalDocumentPreview';
import { buildCostSchedule, type CostScheduleData } from '@/lib/cost-schedule';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tone     = 'professional' | 'consultative' | 'friendly';
type Template = 'classic' | 'executive' | 'modern' | 'bold' | 'minimal';
type Step     = 'configure' | 'generate' | 'preview' | 'export';

interface Section {
  key:   keyof ProposalContent;
  label: string;
}

const SECTIONS: Section[] = [
  { key: 'coverLetter',        label: 'Cover Letter'       },
  { key: 'executiveSummary',   label: 'Executive Summary'  },
  { key: 'scopeOfWork',        label: 'Scope of Work'      },
  { key: 'costBreakdown',      label: 'Cost Schedule'      },
  { key: 'timeline',           label: 'Project Timeline'   },
  { key: 'termsAndConditions', label: 'Terms & Conditions' },
];

const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  { value: 'professional',  label: 'Professional',  description: 'Formal and authoritative — ideal for enterprise clients' },
  { value: 'consultative',  label: 'Consultative',  description: 'Advisory and collaborative — emphasises partnership'     },
  { value: 'friendly',      label: 'Friendly',      description: 'Warm and plain-language — great for smaller clients'     },
];

const TEMPLATE_OPTIONS: { value: Template; label: string; description: string; swatch: string }[] = [
  { value: 'classic',   label: 'Classic',   description: 'Bold navy cover',        swatch: '#1E3A5F' },
  { value: 'executive', label: 'Executive', description: 'Slate charcoal, precise', swatch: '#1E293B' },
  { value: 'modern',    label: 'Modern',    description: 'Teal, contemporary',      swatch: '#0F766E' },
  { value: 'bold',      label: 'Bold',      description: 'Deep purple, high impact', swatch: '#4C1D95' },
  { value: 'minimal',   label: 'Minimal',   description: 'Monochrome, typographic', swatch: '#374151' },
];

interface Props {
  projectId:   number;
  projectName: string;
  onClose:     () => void;
  onSaved:     () => void;  // refresh history after save
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProposalModal({ projectId, projectName, onClose, onSaved }: Props) {
  // Configuration
  const [tone, setTone]                   = useState<Tone>('professional');
  const [template, setTemplate]           = useState<Template>('classic');
  const [includedKeys, setIncludedKeys]   = useState<Set<keyof ProposalContent>>(
    new Set(SECTIONS.map(s => s.key))
  );
  const [additionalContext, setAdditional] = useState('');
  const [validUntil, setValidUntil]       = useState('');

  // Generation state
  const [step, setStep]           = useState<Step>('configure');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]   = useState('');
  const [content, setContent]     = useState<ProposalContent | null>(null);

  // Preview edit state — per-section
  const [editingKey, setEditingKey] = useState<keyof ProposalContent | null>(null);
  const [editDraft, setEditDraft]   = useState('');
  const [regenKey, setRegenKey]     = useState<keyof ProposalContent | null>(null);

  // Raw project data for computing the cost schedule
  type RawCost = Record<string, unknown> & { category: { name: string } };
  type RawCamLoc = { cameraModelId?: number | null; cameraModel?: { manufacturer?: string | null; model?: string | null; cost?: unknown } | null };
  const [rawCosts, setRawCosts]                     = useState<RawCost[]>([]);
  const [rawCamLocs, setRawCamLocs]                 = useState<RawCamLoc[]>([]);
  const [projectFeeSummary, setProjectFeeSummary]   = useState<FeeSummaryData | null>(null);
  const [projectCustomerName, setProjectCustomerName] = useState('');
  const [projectNumber, setProjectNumber]           = useState('');
  const [projectManager, setProjectManager]         = useState('');
  const [projectSites, setProjectSites]             = useState<{ id: number; siteName: string }[]>([]);
  const [projectBuildingName, setProjectBuildingName] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId]         = useState<number | null>(null);
  const [companySettings, setCompanySettings]       = useState<{
    companyName: string; companyTagline: string; logoUrl: string;
    companyPhone: string; companyAddress: string; companyWebsite: string;
  }>({ companyName: 'CSMS', companyTagline: '', logoUrl: '', companyPhone: '', companyAddress: '', companyWebsite: '' });
  const [showDocPreview, setShowDocPreview]         = useState(false);

  const costSchedule: CostScheduleData | null = rawCosts.length > 0 || rawCamLocs.length > 0
    ? buildCostSchedule(rawCamLocs, rawCosts as unknown as Parameters<typeof buildCostSchedule>[1], projectFeeSummary)
    : null;

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setProjectCustomerName(d.customer?.customerName ?? '');
        setProjectNumber(d.projectNumber ?? '');
        setProjectManager(d.projectManager ?? '');
        setProjectBuildingName((d.building as { buildingName?: string } | null)?.buildingName ?? null);
        const sites = (d.sites ?? []) as { id: number; siteName: string }[];
        setProjectSites(sites);
        if (sites.length === 1) setSelectedSiteId(sites[0].id);
        // Also fetch company settings
        fetch('/api/user/settings').then(r => r.ok ? r.json() : {}).then((s: Record<string, string | null>) => {
          setCompanySettings({
            companyName:    s.companyName    ?? 'CSMS',
            companyTagline: s.companyTagline ?? '',
            logoUrl:        s.logoUrl        ?? '',
            companyPhone:   s.companyPhone   ?? '',
            companyAddress: s.companyAddress ?? '',
            companyWebsite: s.companyWebsite ?? '',
          });
        });
        setRawCosts((d.costs ?? []) as RawCost[]);
        setRawCamLocs((d.cameraLocations ?? []) as RawCamLoc[]);
        if (d.feeSummary) {
          const fs = d.feeSummary as Record<string, unknown>;
          setProjectFeeSummary({
            directCostTotal:      Number(fs.directCostTotal),
            overheadPercent:      Number(fs.overheadPercent),
            overheadAmount:       Number(fs.overheadAmount),
            consultingFee:        Number(fs.consultingFee),
            projectManagementFee: Number(fs.projectManagementFee),
            contingencyAmount:    Number(fs.contingencyAmount),
            taxAmount:            Number(fs.taxAmount),
            downPayment:          Number(fs.downPayment ?? 0),
            grandTotal:           Number(fs.grandTotal),
          });
        }
      });
  }, [projectId]);

  // Export state
  const [saving, setSaving]       = useState(false);
  const [savedId, setSavedId]     = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [proposalTitle, setProposalTitle] = useState(`${projectName} Proposal`);


  // ── Section toggle ──────────────────────────────────────────────────────────
  function toggleSection(key: keyof ProposalContent) {
    setIncludedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = useCallback(async (sectionsOverride?: (keyof ProposalContent)[]) => {
    setGenError('');
    setGenerating(true);
    setStep('generate');

    const sections = sectionsOverride ?? Array.from(includedKeys);

    try {
      const res = await fetch(`/api/projects/${projectId}/proposal/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tone, includeSections: sections, additionalContext }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Request failed: ${res.status}`);
      }
      const { content: generated }: { content: ProposalContent } = await res.json();
      setContent(prev => prev ? { ...prev, ...generated } : generated);
      setStep('preview');
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Generation failed');
      setStep('configure');
    } finally {
      setGenerating(false);
    }
  }, [projectId, tone, includedKeys, additionalContext]);

  // ── Per-section regenerate ──────────────────────────────────────────────────
  async function regenerateSection(key: keyof ProposalContent) {
    setRegenKey(key);
    try {
      const res = await fetch(`/api/projects/${projectId}/proposal/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tone, includeSections: [key], additionalContext }),
      });
      if (!res.ok) throw new Error('Regeneration failed');
      const { content: generated }: { content: ProposalContent } = await res.json();
      setContent(prev => prev ? { ...prev, [key]: generated[key] } : prev);
    } catch {
      // silently keep old text
    } finally {
      setRegenKey(null);
    }
  }

  // ── Inline edit ─────────────────────────────────────────────────────────────
  function startEdit(key: keyof ProposalContent) {
    setEditingKey(key);
    setEditDraft(content?.[key] ?? '');
  }
  function saveEdit() {
    if (!editingKey) return;
    setContent(prev => prev ? { ...prev, [editingKey]: editDraft } : prev);
    setEditingKey(null);
  }

  // ── Save proposal ───────────────────────────────────────────────────────────
  async function saveProposal(): Promise<number | null> {
    if (!content) return null;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/proposals`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:      proposalTitle,
          content,
          tone,
          template,
          validUntil: validUntil || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const saved = await res.json();
      setSavedId(saved.id);
      onSaved();
      return saved.id;
    } catch {
      return null;
    } finally {
      setSaving(false);
    }
  }

  // ── Download Word document ──────────────────────────────────────────────────
  async function downloadPdf() {
    setPdfLoading(true);
    try {
      let id = savedId;
      if (!id) id = await saveProposal();
      if (!id) return;

      const selectedSite = projectSites.find(s => s.id === selectedSiteId);
      const res = await fetch(`/api/projects/${projectId}/proposals/${id}/docx`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ template, siteName: selectedSite?.siteName ?? null }),
      });
      if (!res.ok) throw new Error('Word generation failed');
      const blob = await res.blob();
      const filename = `proposal-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.docx`;

      // Use native save dialog if available (Chromium), otherwise fallback
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'Word Document', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (e) {
          // User cancelled picker — abort silently
          if ((e as { name?: string }).name === 'AbortError') return;
          // Fall through to standard download
        }
      }

      // Fallback: standard anchor download
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // could show toast
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Copy email draft ────────────────────────────────────────────────────────
  async function copyEmailDraft() {
    const email = `Dear Team,

Please find attached our proposal for ${projectName}.

We have outlined the scope of work, investment summary, and project timeline in the enclosed document. We are confident this solution will meet your security and operational requirements.

Please review the proposal at your convenience and do not hesitate to reach out with any questions. We look forward to the opportunity to work with you.

Best regards,
[Your Name]`;

    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const stepLabels: Record<Step, string> = {
    configure: '1 · Configure',
    generate:  '2 · Generate',
    preview:   '3 · Preview & Edit',
    export:    '4 · Export',
  };
  const steps: Step[] = ['configure', 'generate', 'preview', 'export'];

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Prepare Proposal</h2>
            <p className="text-xs text-gray-500 mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex border-b border-gray-100 shrink-0 bg-gray-50">
          {steps.map((s, i) => (
            <div key={s} className={`flex-1 text-center py-2 text-xs font-medium border-b-2 transition-colors ${
              step === s ? 'border-blue-600 text-blue-700 bg-white' :
              steps.indexOf(step) > i ? 'border-green-500 text-green-700' :
              'border-transparent text-gray-400'
            }`}>
              {stepLabels[s]}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 1: Configure ─────────────────────────────────────────── */}
          {step === 'configure' && (
            <div className="space-y-6">
              {genError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {genError}
                </div>
              )}

              {/* Tone */}
              <div>
                <label className="form-label">Proposal Tone</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {TONE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        tone === t.value
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-gray-900">{t.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sections */}
              <div>
                <label className="form-label">Include Sections</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {SECTIONS.map(s => (
                    <label key={s.key} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={includedKeys.has(s.key)}
                        onChange={() => toggleSection(s.key)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Additional context */}
              <div>
                <label className="form-label">Additional Context <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={additionalContext}
                  onChange={e => setAdditional(e.target.value)}
                  rows={3}
                  placeholder="e.g. Emphasise the 5-year warranty. Client prefers phased installation."
                  className="form-input resize-none mt-1"
                />
              </div>

              {/* Template */}
              <div>
                <label className="form-label">Design Template</label>
                <div className="grid grid-cols-5 gap-2 mt-1">
                  {TEMPLATE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTemplate(t.value)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        template === t.value
                          ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="w-full h-6 rounded mb-1.5"
                        style={{ backgroundColor: t.swatch }}
                      />
                      <div className="text-xs font-semibold text-gray-900">{t.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-tight">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Valid until */}
              <div>
                <label className="form-label">Proposal Valid Until <span className="text-gray-400 font-normal">(optional — defaults to 30 days)</span></label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                  className="form-input mt-1"
                />
              </div>

              {/* Site */}
              {projectSites.length > 0 && (
                <div>
                  <label className="form-label">Project Site <span className="text-gray-400 font-normal">(shown on cover page)</span></label>
                  <select
                    value={selectedSiteId ?? ''}
                    onChange={e => setSelectedSiteId(e.target.value ? Number(e.target.value) : null)}
                    className="form-input mt-1"
                  >
                    <option value="">— Not specified —</option>
                    {projectSites.map(s => (
                      <option key={s.id} value={s.id}>{s.siteName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Generating ────────────────────────────────────────── */}
          {step === 'generate' && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <SparklesIcon className="w-7 h-7 text-blue-600 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900 mb-1">AI is writing your proposal…</p>
                <p className="text-sm text-gray-500">This usually takes 15–30 seconds.</p>
              </div>
              <div className="w-64 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full animate-[progress_25s_linear_forwards]" style={{ width: '100%' }} />
              </div>
              <div className="space-y-1.5 w-full max-w-xs">
                {SECTIONS.filter(s => includedKeys.has(s.key)).map(s => (
                  <div key={s.key} className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-blue-200 animate-pulse" />
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Preview & Edit ────────────────────────────────────── */}
          {step === 'preview' && content && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="form-label">Proposal Title</label>
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={e => setProposalTitle(e.target.value)}
                    className="form-input mt-1"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowDocPreview(true)}
                  className="btn-secondary shrink-0 mt-5"
                >
                  👁 Preview Document
                </button>
              </div>

              {SECTIONS.filter(s => {
                if (s.key === 'costBreakdown') return includedKeys.has(s.key) && !!costSchedule;
                return includedKeys.has(s.key) && !!content[s.key];
              }).map(s => {
                const isCostSchedule = s.key === 'costBreakdown';
                return (
                  <div key={s.key} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{s.label}</span>
                      {!isCostSchedule && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => regenerateSection(s.key)}
                            disabled={regenKey === s.key}
                            title="Regenerate this section"
                            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                          >
                            <ArrowPathIcon className={`w-3.5 h-3.5 ${regenKey === s.key ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => editingKey === s.key ? saveEdit() : startEdit(s.key)}
                            title={editingKey === s.key ? 'Save edits' : 'Edit section'}
                            className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                          >
                            {editingKey === s.key
                              ? <CheckIcon className="w-3.5 h-3.5 text-green-600" />
                              : <PencilSquareIcon className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {isCostSchedule ? (
                        <div className="text-xs text-gray-500 italic">Live cost schedule — {costSchedule!.groups.length} line items · Grand total {costSchedule!.grandTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
                      ) : editingKey === s.key ? (
                        <textarea
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          rows={8}
                          className="form-input resize-y w-full text-sm"
                          autoFocus
                        />
                      ) : (
                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {regenKey === s.key
                            ? <span className="text-gray-400 italic">Regenerating…</span>
                            : content[s.key]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Step 4: Export ────────────────────────────────────────────── */}
          {step === 'export' && (
            <div className="space-y-5">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                ✓ Proposal is ready. Download as a Word document, save as draft, or copy a covering email.
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={downloadPdf}
                  disabled={pdfLoading}
                  className="btn-primary justify-center py-3 gap-2"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  {pdfLoading ? 'Generating…' : 'Download Word Document'}
                </button>
                <button
                  onClick={async () => { await saveProposal(); }}
                  disabled={saving || !!savedId}
                  className="btn-secondary justify-center py-3 gap-2"
                >
                  <BookmarkIcon className="w-5 h-5" />
                  {savedId ? '✓ Saved as Draft' : saving ? 'Saving…' : 'Save as Draft'}
                </button>

                <button
                  onClick={copyEmailDraft}
                  className="btn-secondary justify-center py-3 gap-2"
                >
                  <ClipboardDocumentIcon className="w-5 h-5" />
                  {copied ? '✓ Copied to Clipboard' : 'Copy Covering Email'}
                </button>
              </div>

              {savedId && (
                <div className="text-xs text-gray-500 text-center">
                  Saved — you can update the status from the Proposal History panel on the project page.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 shrink-0">
          <button
            onClick={() => {
              if (step === 'preview') { setStep('configure'); setShowDocPreview(false); }
              else if (step === 'export') setStep('preview');
            }}
            className={`btn-secondary gap-1.5 ${step === 'configure' || step === 'generate' ? 'invisible' : ''}`}
          >
            <ArrowLeftIcon className="w-4 h-4" /> Back
          </button>

          <div className="flex gap-2">
            {step === 'configure' && (
              <button
                onClick={() => generate()}
                disabled={generating || includedKeys.size === 0}
                className="btn-primary gap-2"
              >
                <SparklesIcon className="w-4 h-4" />
                Generate Proposal
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            )}
            {step === 'preview' && (
              <button onClick={() => setStep('export')} className="btn-primary gap-2">
                Continue to Export <ArrowRightIcon className="w-4 h-4" />
              </button>
            )}
            {step === 'export' && (
              <button onClick={onClose} className="btn-primary">Done</button>
            )}
          </div>
        </div>

      </div>
    </div>

    {/* Document preview overlay */}
    {showDocPreview && content && (
      <ProposalDocumentPreview
        content={content}
        templateId={template}
        projectName={projectName}
        customerName={projectCustomerName || 'Client'}
        projectNumber={projectNumber}
        projectManager={projectManager}
        siteName={projectSites.find(s => s.id === selectedSiteId)?.siteName}
        buildingName={projectBuildingName}
        validUntil={validUntil || '30 days from date of issue'}
        date={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        companyName={companySettings.companyName}
        companyTagline={companySettings.companyTagline}
        logoUrl={companySettings.logoUrl}
        companyPhone={companySettings.companyPhone}
        companyAddress={companySettings.companyAddress}
        companyWebsite={companySettings.companyWebsite}
        feeSummary={projectFeeSummary}
        costSchedule={costSchedule}
        onClose={() => setShowDocPreview(false)}
        onExport={downloadPdf}
        exporting={pdfLoading}
      />
    )}
    </>
  );
}
