'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  XMarkIcon, ArrowRightIcon, ArrowLeftIcon,
  ArrowDownTrayIcon, BookmarkIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { buildCostSchedule, type CostScheduleData } from '@/lib/cost-schedule';
import {
  buildInvoiceRows, resolveAmountDue, basisCaption, buildInvoiceNumber, usd,
  type InvoiceDetail, type InvoicePaymentBasis,
} from '@/lib/invoice';

type Step = 'configure' | 'preview';

interface Props {
  projectId:   number;
  projectName: string;
  onClose:     () => void;
  onSaved:     () => void;
}

export function InvoiceModal({ projectId, projectName, onClose, onSaved }: Props) {
  // ── Options ──────────────────────────────────────────────────────────────
  const [detail, setDetail]             = useState<InvoiceDetail>('line-items');
  const [paymentBasis, setPaymentBasis] = useState<InvoicePaymentBasis>('direct-total');
  const [billToName, setBillToName]     = useState('');
  const [billToAddress, setBillToAddress] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [poNumber, setPoNumber]           = useState('');
  const [salesperson, setSalesperson]     = useState('');
  const [terms, setTerms]                 = useState('COD');
  const [issuedAt, setIssuedAt]           = useState(new Date().toISOString().slice(0, 10));

  // ── Flow ───────────────────────────────────────────────────────────────────
  const [step, setStep]       = useState<Step>('configure');
  const [saving, setSaving]   = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [savedNumber, setSavedNumber] = useState<string | null>(null);
  const [dlLoading, setDlLoading]     = useState<'pdf' | 'docx' | null>(null);
  const [error, setError]     = useState('');

  // ── Project data for live preview ───────────────────────────────────────────
  type RawCost = Record<string, unknown> & { category: { name: string } };
  type RawCamLoc = { cameraModelId?: number | null; cameraModel?: { manufacturer?: string | null; model?: string | null; cost?: unknown } | null };
  const [rawCosts, setRawCosts]     = useState<RawCost[]>([]);
  const [rawCamLocs, setRawCamLocs] = useState<RawCamLoc[]>([]);
  const [feeSummary, setFeeSummary] = useState<Parameters<typeof buildCostSchedule>[2]>(null);
  const [projectNumber, setProjectNumber] = useState<string | null>(null);
  const [invoiceCount, setInvoiceCount]   = useState(0);

  const schedule: CostScheduleData | null = (rawCosts.length > 0 || rawCamLocs.length > 0)
    ? buildCostSchedule(rawCamLocs, rawCosts as unknown as Parameters<typeof buildCostSchedule>[1], feeSummary)
    : null;

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setRawCosts((d.costs ?? []) as RawCost[]);
        setRawCamLocs((d.cameraLocations ?? []) as RawCamLoc[]);
        setFeeSummary((d.feeSummary ?? null) as Parameters<typeof buildCostSchedule>[2]);
        setProjectNumber(d.projectNumber ?? null);
        const cust = d.customer ?? {};
        setBillToName([cust.customerName, cust.contactName].filter(Boolean).join(' — '));
        setBillToAddress(cust.billingAddress ?? '');
      });
    fetch(`/api/projects/${projectId}/invoices`)
      .then(r => r.ok ? r.json() : [])
      .then((list: unknown[]) => setInvoiceCount(Array.isArray(list) ? list.length : 0))
      .catch(() => {});
  }, [projectId]);

  const previewRows  = schedule ? buildInvoiceRows(schedule, detail, paymentBasis) : [];
  const previewTotal = schedule ? resolveAmountDue(schedule, paymentBasis) : 0;
  const nextNumber          = buildInvoiceNumber(projectNumber, invoiceCount + 1);
  const effectiveInvNumber  = invoiceNumber.trim() || nextNumber;

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveInvoice = useCallback(async (): Promise<number | null> => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          detail, paymentBasis,
          invoiceNumber: effectiveInvNumber,
          billTo: { name: billToName, address: billToAddress },
          poNumber, salesperson, terms, issuedAt,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const saved = await res.json();
      setSavedId(saved.id);
      setSavedNumber(saved.invoiceNumber);
      onSaved();
      return saved.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  }, [projectId, detail, paymentBasis, invoiceNumber, billToName, billToAddress, poNumber, salesperson, terms, issuedAt, onSaved, nextNumber]);

  // ── Download ─────────────────────────────────────────────────────────────
  async function download(kind: 'pdf' | 'docx') {
    setDlLoading(kind);
    try {
      let id = savedId;
      if (!id) id = await saveInvoice();
      if (!id) return;

      const res = await fetch(`/api/projects/${projectId}/invoices/${id}/${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!res.ok) throw new Error('Generation failed');
      const blob = await res.blob();
      const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const filename = `invoice-${slug}-${savedNumber ?? id}.${kind}`;

      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const accept = kind === 'pdf'
            ? { 'application/pdf': ['.pdf'] }
            : { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] };
          const handle = await (window as Window & { showSaveFilePicker: (o: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: kind === 'pdf' ? 'PDF Document' : 'Word Document', accept }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (e) {
          if ((e as { name?: string }).name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDlLoading(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const noData = schedule !== null && schedule.groups.length === 0
    && schedule.consultingFee === 0 && schedule.projectManagementFee === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Prepare Invoice</h2>
            <p className="text-xs text-gray-500 mt-0.5">{projectName} · No. {savedNumber ?? nextNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex border-b border-gray-100 shrink-0 bg-gray-50">
          {(['configure', 'preview'] as Step[]).map((s, i) => (
            <div key={s} className={`flex-1 text-center py-2 text-xs font-medium border-b-2 transition-colors ${
              step === s ? 'border-blue-600 text-blue-700 bg-white'
                : (['configure', 'preview'] as Step[]).indexOf(step) > i ? 'border-green-500 text-green-700'
                : 'border-transparent text-gray-400'
            }`}>
              {i + 1} · {s === 'configure' ? 'Configure' : 'Preview & Export'}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {step === 'configure' && (
            <div className="space-y-6">
              {/* Level of detail */}
              <div>
                <label className="form-label">Level of Detail</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {([
                    { v: 'line-items', label: 'Itemized', desc: 'List every cost line item' },
                    { v: 'summary',    label: 'Summary',  desc: 'Roll up into category totals' },
                  ] as { v: InvoiceDetail; label: string; desc: string }[]).map(o => (
                    <button key={o.v} onClick={() => setDetail(o.v)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        detail === o.v ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="text-xs font-semibold text-gray-900">{o.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{o.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment basis */}
              <div>
                <label className="form-label">Amount Due</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {([
                    { v: 'direct-total',  label: 'Direct Total',        desc: 'Equipment & labor (pre-fees)' },
                    { v: 'consulting-pm', label: 'Consulting + PM Fee',  desc: 'Remaining consulting & PM fees' },
                  ] as { v: InvoicePaymentBasis; label: string; desc: string }[]).map(o => (
                    <button key={o.v} onClick={() => setPaymentBasis(o.v)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        paymentBasis === o.v ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="text-xs font-semibold text-gray-900">{o.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{o.desc}</div>
                    </button>
                  ))}
                </div>
                {schedule && (
                  <p className="text-xs text-gray-500 mt-2">
                    Resolves to <span className="font-semibold text-gray-800">{usd(previewTotal)}</span> — {basisCaption(paymentBasis)}.
                  </p>
                )}
              </div>

              {/* Bill To */}
              <div>
                <label className="form-label">Bill To</label>
                <input type="text" value={billToName} onChange={e => setBillToName(e.target.value)}
                  placeholder="Customer / contact name" className="form-input mt-1" />
                <textarea value={billToAddress} onChange={e => setBillToAddress(e.target.value)} rows={3}
                  placeholder="Billing address" className="form-input resize-none mt-2" />
              </div>

              {/* Meta fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Invoice Number</label>
                  <input type="text" value={effectiveInvNumber} onChange={e => setInvoiceNumber(e.target.value)}
                    className="form-input mt-1" />
                </div>
                <div>
                  <label className="form-label">P.O. Number <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} className="form-input mt-1" />
                </div>
                <div>
                  <label className="form-label">Salesperson <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="text" value={salesperson} onChange={e => setSalesperson(e.target.value)} className="form-input mt-1" />
                </div>
                <div>
                  <label className="form-label">Terms</label>
                  <input type="text" value={terms} onChange={e => setTerms(e.target.value)} className="form-input mt-1" />
                </div>
                <div>
                  <label className="form-label">Invoice Date</label>
                  <input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} className="form-input mt-1" />
                </div>
              </div>

              {noData && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
                  This project has no cost line items or fees yet. The invoice will total $0.00 until costs are added.
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white text-xs">
                      <th className="text-left px-3 py-2 w-16">Qty</th>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2 w-24">Unit Price</th>
                      <th className="text-right px-3 py-2 w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-2 text-gray-700">{r.quantity}</td>
                        <td className="px-3 py-2 text-gray-700">{r.description}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.unitPrice == null ? '' : usd(r.unitPrice)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{usd(r.amount)}</td>
                      </tr>
                    ))}
                    {previewRows.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400 text-sm">No line items.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">Total Due: {usd(previewTotal)}</div>
                  <div className="text-xs text-gray-500 italic">{basisCaption(paymentBasis)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <button onClick={() => download('pdf')} disabled={dlLoading !== null} className="btn-primary justify-center py-3 gap-2">
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  {dlLoading === 'pdf' ? 'Generating…' : 'Download PDF'}
                </button>
                <button onClick={() => download('docx')} disabled={dlLoading !== null} className="btn-secondary justify-center py-3 gap-2">
                  <DocumentTextIcon className="w-5 h-5" />
                  {dlLoading === 'docx' ? 'Generating…' : 'Download Word Document'}
                </button>
                <button onClick={() => saveInvoice()} disabled={saving || !!savedId} className="btn-secondary justify-center py-3 gap-2">
                  <BookmarkIcon className="w-5 h-5" />
                  {savedId ? `✓ Saved as ${savedNumber}` : saving ? 'Saving…' : 'Save as Draft'}
                </button>
              </div>
              {savedId && (
                <div className="text-xs text-gray-500 text-center">
                  Saved — change the status anytime from the Invoice History panel on the project page.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 shrink-0">
          <button
            onClick={() => { if (step === 'preview') setStep('configure'); }}
            className={`btn-secondary gap-1.5 ${step === 'configure' ? 'invisible' : ''}`}>
            <ArrowLeftIcon className="w-4 h-4" /> Back
          </button>
          {step === 'configure' ? (
            <button onClick={() => setStep('preview')} className="btn-primary gap-2">
              Preview Invoice <ArrowRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={onClose} className="btn-primary">Done</button>
          )}
        </div>

      </div>
    </div>
  );
}
