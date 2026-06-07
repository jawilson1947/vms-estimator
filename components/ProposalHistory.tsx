'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDownIcon, ChevronUpIcon,
  ArrowDownTrayIcon, TrashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProposalStatus   = 'draft' | 'sent' | 'accepted' | 'rejected';
type ProposalTemplate = 'classic' | 'executive' | 'modern' | 'bold' | 'minimal';

interface ProposalSummary {
  id:         number;
  title:      string;
  tone:       string;
  template:   ProposalTemplate;
  status:     ProposalStatus;
  validUntil: string | null;
  createdAt:  string;
}

const TEMPLATE_SWATCHES: Record<ProposalTemplate, { color: string; label: string }> = {
  classic:   { color: '#1E3A5F', label: 'Classic'   },
  executive: { color: '#1E293B', label: 'Executive' },
  modern:    { color: '#0F766E', label: 'Modern'    },
  bold:      { color: '#4C1D95', label: 'Bold'      },
  minimal:   { color: '#374151', label: 'Minimal'   },
};

const TEMPLATE_OPTIONS: ProposalTemplate[] = ['classic', 'executive', 'modern', 'bold', 'minimal'];

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-600',
};

const STATUS_OPTIONS: ProposalStatus[] = ['draft', 'sent', 'accepted', 'rejected'];

interface Props {
  projectId:   number;
  projectName: string;
  refreshKey?: number;  // optional — bumping triggers a reload
  onReopen?:   (proposalId: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProposalHistory({ projectId, projectName, refreshKey, onReopen }: Props) {
  const [open, setOpen]           = useState(false);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading]     = useState(false);
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/proposals`);
      if (res.ok) setProposals(await res.json());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open || (refreshKey ?? 0) > 0) load();
  }, [open, refreshKey, load]);

  // Listen for proposal-saved custom event so the history auto-refreshes
  useEffect(() => {
    const handler = () => { setOpen(true); load(); };
    window.addEventListener('proposal-saved', handler);
    return () => window.removeEventListener('proposal-saved', handler);
  }, [load]);

  async function updateStatus(id: number, status: ProposalStatus) {
    await fetch(`/api/projects/${projectId}/proposals/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    });
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  }

  async function updateTemplate(id: number, template: ProposalTemplate) {
    await fetch(`/api/projects/${projectId}/proposals/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ template }),
    });
    setProposals(prev => prev.map(p => p.id === id ? { ...p, template } : p));
  }

  async function deleteProposal(id: number) {
    if (!confirm('Delete this proposal?')) return;
    await fetch(`/api/projects/${projectId}/proposals/${id}`, { method: 'DELETE' });
    setProposals(prev => prev.filter(p => p.id !== id));
  }

  async function downloadPdf(id: number) {
    setPdfLoading(id);
    const proposal = proposals.find(p => p.id === id);
    try {
      const res = await fetch(`/api/projects/${projectId}/proposals/${id}/docx`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ template: proposal?.template ?? 'classic' }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `proposal-${projectName.toLowerCase().replace(/\s+/g, '-')}-v${id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(null);
    }
  }

  const isExpired = (validUntil: string | null) =>
    validUntil ? new Date(validUntil) < new Date() : false;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">Proposal History</span>
          {proposals.length > 0 && (
            <span className="badge bg-gray-100 text-gray-600">{proposals.length}</span>
          )}
        </div>
        {open
          ? <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="px-5 py-6 text-sm text-gray-400 text-center">Loading…</div>
          ) : proposals.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-400 text-center">No proposals yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {proposals.map((p, idx) => (
                <div key={p.id} className="px-5 py-4 flex items-center gap-4">
                  {/* Version number */}
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gray-600">v{proposals.length - idx}</span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{p.title}</span>
                      <span className={`badge text-xs capitalize ${STATUS_COLORS[p.status]}`}>
                        {p.status}
                      </span>
                      {isExpired(p.validUntil) && p.status === 'draft' && (
                        <span className="badge text-xs bg-orange-50 text-orange-600">Expired</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-3">
                      <span>{new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="capitalize">{p.tone}</span>
                      {p.validUntil && (
                        <span>Valid until {new Date(p.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                    </div>
                  </div>

                  {/* Template selector */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: TEMPLATE_SWATCHES[p.template ?? 'classic'].color }}
                    />
                    <select
                      value={p.template ?? 'classic'}
                      onChange={e => updateTemplate(p.id, e.target.value as ProposalTemplate)}
                      className="form-select text-xs py-1 pr-7 w-28"
                    >
                      {TEMPLATE_OPTIONS.map(t => (
                        <option key={t} value={t}>{TEMPLATE_SWATCHES[t].label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status selector */}
                  <select
                    value={p.status}
                    onChange={e => updateStatus(p.id, e.target.value as ProposalStatus)}
                    className="form-select text-xs py-1 pr-7 w-28"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => downloadPdf(p.id)}
                      disabled={pdfLoading === p.id}
                      title="Download PDF"
                      className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <ArrowDownTrayIcon className={`w-4 h-4 ${pdfLoading === p.id ? 'animate-bounce' : ''}`} />
                    </button>
                    <button
                      onClick={() => deleteProposal(p.id)}
                      title="Delete"
                      className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
