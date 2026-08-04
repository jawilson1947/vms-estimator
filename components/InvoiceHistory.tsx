'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDownIcon, ChevronUpIcon,
  ArrowDownTrayIcon, DocumentTextIcon, TrashIcon, BanknotesIcon,
} from '@heroicons/react/24/outline';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';

interface InvoiceSummary {
  id:            number;
  invoiceNumber: string;
  sequence:      number;
  detail:        string;
  paymentBasis:  string;
  amountDue:     string | number;
  status:        InvoiceStatus;
  poNumber:      string | null;
  terms:         string | null;
  issuedAt:      string | null;
  createdAt:     string;
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent:  'bg-blue-50 text-blue-700',
  paid:  'bg-green-50 text-green-700',
  void:  'bg-red-50 text-red-600',
};
const STATUS_OPTIONS: InvoiceStatus[] = ['draft', 'sent', 'paid', 'void'];

const usd = (v: string | number) =>
  Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

interface Props {
  projectId:   number;
  projectName: string;
  refreshKey?: number;
  readOnly?:   boolean; // hide status editing + delete (restricted viewers)
}

export function InvoiceHistory({ projectId, projectName, refreshKey, readOnly }: Props) {
  const [open, setOpen]         = useState(false);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading]   = useState(false);
  const [dlLoading, setDlLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices`);
      if (res.ok) setInvoices(await res.json());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open || (refreshKey ?? 0) > 0) load();
  }, [open, refreshKey, load]);

  useEffect(() => {
    const handler = () => { setOpen(true); load(); };
    window.addEventListener('invoice-saved', handler);
    return () => window.removeEventListener('invoice-saved', handler);
  }, [load]);

  async function updateStatus(id: number, status: InvoiceStatus) {
    await fetch(`/api/projects/${projectId}/invoices/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    });
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  }

  async function deleteInvoice(id: number) {
    if (!confirm('Delete this invoice?')) return;
    await fetch(`/api/projects/${projectId}/invoices/${id}`, { method: 'DELETE' });
    setInvoices(prev => prev.filter(i => i.id !== id));
  }

  async function download(id: number, kind: 'pdf' | 'docx') {
    setDlLoading(`${id}-${kind}`);
    const inv = invoices.find(i => i.id === id);
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices/${id}/${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const slug = projectName.toLowerCase().replace(/\s+/g, '-');
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `invoice-${slug}-${inv?.invoiceNumber ?? id}.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDlLoading(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BanknotesIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">Invoice History</span>
          {invoices.length > 0 && (
            <span className="badge bg-gray-100 text-gray-600">{invoices.length}</span>
          )}
        </div>
        {open ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="px-5 py-6 text-sm text-gray-400 text-center">Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-400 text-center">No invoices yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <div key={inv.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{inv.invoiceNumber}</span>
                      <span className={`badge text-xs capitalize ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                      <span className="text-sm font-semibold text-gray-900">{usd(inv.amountDue)}</span>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-3">
                      <span>{new Date(inv.issuedAt ?? inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span>{inv.paymentBasis === 'consulting-pm' ? 'Consulting + PM' : inv.paymentBasis === 'combined' ? 'Combined' : 'Direct Total'}</span>
                      <span className="capitalize">{inv.detail === 'summary' ? 'Summary' : 'Itemized'}</span>
                      {inv.terms && <span>{inv.terms}</span>}
                    </div>
                  </div>

                  {readOnly ? (
                    <span className="text-xs text-gray-500 w-24 capitalize">{inv.status}</span>
                  ) : (
                    <select
                      value={inv.status}
                      onChange={e => updateStatus(inv.id, e.target.value as InvoiceStatus)}
                      className="form-select text-xs py-1 pr-7 w-24"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => download(inv.id, 'pdf')} disabled={dlLoading === `${inv.id}-pdf`}
                      title="Download PDF" className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <ArrowDownTrayIcon className={`w-4 h-4 ${dlLoading === `${inv.id}-pdf` ? 'animate-bounce' : ''}`} />
                    </button>
                    <button onClick={() => download(inv.id, 'docx')} disabled={dlLoading === `${inv.id}-docx`}
                      title="Download Word" className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <DocumentTextIcon className={`w-4 h-4 ${dlLoading === `${inv.id}-docx` ? 'animate-bounce' : ''}`} />
                    </button>
                    {!readOnly && (
                      <button onClick={() => deleteInvoice(inv.id)}
                        title="Delete" className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
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
