'use client';

import { useState, useMemo } from 'react';
import { PlusIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CostLine {
  id:           number;
  costCategory: string;
  description:  string;
  quantity:     number;
  unitCost:     number;
  markupPercent:number;
  lineTotal:    number;
  vendor:       string;
  billable:     boolean;
  notes:        string;
}

interface FeeSummary {
  overheadPercent:      number;
  overheadAmount:       number;
  consultingFee:        number;
  projectManagementFee: number;
  contingencyAmount:    number;
  taxAmount:            number;
  grandTotal:           number;
}

interface Props {
  projectId:           number;
  overheadRateDefault: number;
  initialCosts:        CostLine[];
  initialSummary:      FeeSummary | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'CAMERA_EQUIPMENT','NETWORK_EQUIPMENT','CABLING','MOUNTING_HARDWARE',
  'LICENSING','LABOR','CONSULTING','PROJECT_MANAGEMENT',
  'OVERHEAD','TRAVEL','PERMITS','CONTINGENCY','OTHER',
];

const CAT_LABELS: Record<string, string> = {
  CAMERA_EQUIPMENT: 'Camera Equipment',  NETWORK_EQUIPMENT: 'Network Equipment',
  CABLING: 'Cabling',                    MOUNTING_HARDWARE: 'Mounting Hardware',
  LICENSING: 'Licensing',               LABOR: 'Labor',
  CONSULTING: 'Consulting',             PROJECT_MANAGEMENT: 'Project Management',
  OVERHEAD: 'Overhead',                 TRAVEL: 'Travel',
  PERMITS: 'Permits',                   CONTINGENCY: 'Contingency',
  OTHER: 'Other',
};

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1','#14b8a6','#a855f7','#64748b'];

const emptyLine = {
  costCategory: 'CAMERA_EQUIPMENT', description: '', quantity: 1,
  unitCost: 0, markupPercent: 0, vendor: '', billable: true, notes: '',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CostEstimator({ projectId, overheadRateDefault, initialCosts, initialSummary }: Props) {
  const [costs, setCosts]         = useState<CostLine[]>(initialCosts);
  const [summary, setSummary]     = useState<FeeSummary | null>(initialSummary);
  const [editId, setEditId]       = useState<number | 'new' | null>(null);
  const [lineForm, setLineForm]   = useState(emptyLine);
  const [fees, setFees]           = useState({
    overheadPercent:      initialSummary?.overheadPercent      ?? overheadRateDefault,
    consultingFee:        initialSummary?.consultingFee        ?? 0,
    projectManagementFee: initialSummary?.projectManagementFee ?? 0,
    contingencyAmount:    initialSummary?.contingencyAmount    ?? 0,
    taxAmount:            initialSummary?.taxAmount            ?? 0,
  });
  const [savingFees, setSavingFees] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [activeTab, setActiveTab]   = useState<'items'|'chart'>('items');

  // ── Derived totals ──────────────────────────────────────────────────────────
  const directTotal = useMemo(() => costs.reduce((s, c) => s + c.lineTotal, 0), [costs]);

  const overheadAmount  = directTotal * (fees.overheadPercent / 100);
  const grandTotal      = directTotal + overheadAmount + fees.consultingFee + fees.projectManagementFee + fees.contingencyAmount + fees.taxAmount;
  const billableTotal   = costs.filter(c => c.billable).reduce((s, c) => s + c.lineTotal, 0);
  const margin          = grandTotal > 0 ? ((grandTotal - directTotal) / grandTotal) * 100 : 0;

  // ── Category totals for charts ──────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    costs.forEach(c => { map[c.costCategory] = (map[c.costCategory] ?? 0) + c.lineTotal; });
    return Object.entries(map)
      .map(([cat, total]) => ({ name: CAT_LABELS[cat] ?? cat, total }))
      .sort((a, b) => b.total - a.total);
  }, [costs]);

  // ── Line item CRUD ──────────────────────────────────────────────────────────
  function startNew()        { setLineForm(emptyLine); setEditId('new'); }
  function startEdit(c: CostLine) {
    setLineForm({
      costCategory: c.costCategory, description: c.description, quantity: c.quantity,
      unitCost: c.unitCost, markupPercent: c.markupPercent,
      vendor: c.vendor, billable: c.billable, notes: c.notes,
    });
    setEditId(c.id);
  }
  function cancelEdit() { setEditId(null); }

  function handleLineChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, type, value } = e.target;
    setLineForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function saveLine() {
    setSavingLine(true);
    const isNew = editId === 'new';
    const url   = isNew ? `/api/projects/${projectId}/costs` : `/api/project-costs/${editId}`;
    const res   = await fetch(url, {
      method:  isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(lineForm),
    });
    setSavingLine(false);
    if (!res.ok) return;
    const saved: CostLine = await res.json();
    setCosts(prev => isNew ? [...prev, saved] : prev.map(c => c.id === saved.id ? saved : c));
    setEditId(null);
  }

  async function deleteLine(id: number) {
    if (!confirm('Remove this cost line?')) return;
    await fetch(`/api/project-costs/${id}`, { method: 'DELETE' });
    setCosts(prev => prev.filter(c => c.id !== id));
  }

  // ── Fee summary save ────────────────────────────────────────────────────────
  async function saveFees() {
    setSavingFees(true);
    const res = await fetch(`/api/projects/${projectId}/fee-summary`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fees),
    });
    setSavingFees(false);
    if (res.ok) setSummary(await res.json());
  }

  // ── Render helpers ──────────────────────────────────────────────────────────
  const SummaryRow = ({ label, value, bold = false, highlight = false }:
    { label: string; value: string; bold?: boolean; highlight?: boolean }) => (
    <div className={`flex justify-between py-1.5 text-sm border-b border-gray-100 last:border-0 ${bold ? 'font-semibold' : ''}`}>
      <span className={highlight ? 'text-blue-700' : 'text-gray-600'}>{label}</span>
      <span className={highlight ? 'text-blue-700 text-base' : 'text-gray-900'}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Direct Costs',    value: fmt(directTotal),   color: 'text-gray-900' },
          { label: 'Grand Total',     value: fmt(grandTotal),    color: 'text-blue-700' },
          { label: 'Billable Amount', value: fmt(billableTotal), color: 'text-green-700' },
          { label: 'Margin',          value: `${margin.toFixed(1)}%`, color: margin > 20 ? 'text-green-700' : margin > 10 ? 'text-amber-600' : 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Left: Line items ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-gray-200">
            {(['items','chart'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t === 'items' ? 'Line Items' : 'Charts'}
              </button>
            ))}
          </div>

          {activeTab === 'items' && (
            <>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 w-36">Category</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Description</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-16">Qty</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-24">Unit Cost</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-16">Markup</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-24">Total</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {costs.map(c => (
                      editId === c.id ? (
                        <EditRow key={c.id} form={lineForm} onChange={handleLineChange}
                          onSave={saveLine} onCancel={cancelEdit} saving={savingLine} />
                      ) : (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <span className="badge bg-gray-100 text-gray-600 text-xs whitespace-nowrap">
                              {CAT_LABELS[c.costCategory]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">{c.description || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{c.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{fmt(c.unitCost)}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{c.markupPercent}%</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(c.lineTotal)}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => startEdit(c)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                                <PencilSquareIcon className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteLine(c.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}

                    {editId === 'new' && (
                      <EditRow form={lineForm} onChange={handleLineChange}
                        onSave={saveLine} onCancel={cancelEdit} saving={savingLine} />
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={5} className="px-3 py-2.5 text-sm font-semibold text-gray-700 text-right">
                        Direct Cost Total
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">{fmt(directTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {editId !== 'new' && (
                <button onClick={startNew} className="btn-secondary w-full justify-center py-2.5 border-dashed">
                  <PlusIcon className="w-4 h-4" /> Add Line Item
                </button>
              )}
            </>
          )}

          {activeTab === 'chart' && (
            <div className="space-y-4">
              {/* Bar chart by category */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Category</h3>
                {byCategory.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No cost data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byCategory} margin={{ left: 10 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pie chart */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
                {byCategory.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No cost data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={byCategory} dataKey="total" nameKey="name"
                        cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {byCategory.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Grand total waterfall summary */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Total Build-up</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={[
                      { name: 'Direct Costs',  value: directTotal },
                      { name: 'Overhead',      value: overheadAmount },
                      { name: 'Consulting',    value: fees.consultingFee },
                      { name: 'PM Fee',        value: fees.projectManagementFee },
                      { name: 'Contingency',   value: fees.contingencyAmount },
                      { name: 'Tax',           value: fees.taxAmount },
                    ].filter(d => d.value > 0)}
                    margin={{ left: 10 }}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'].map((c,i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Fee Summary ───────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Fee Summary</h2>

            <div className="space-y-3 mb-5">
              {[
                { label: 'Overhead %',        key: 'overheadPercent',      suffix: '%' },
                { label: 'Consulting Fee',    key: 'consultingFee',        prefix: '$' },
                { label: 'PM Fee',            key: 'projectManagementFee', prefix: '$' },
                { label: 'Contingency',       key: 'contingencyAmount',    prefix: '$' },
                { label: 'Tax',               key: 'taxAmount',            prefix: '$' },
              ].map(({ label, key, prefix, suffix }) => (
                <div key={key}>
                  <label className="form-label text-xs">{label}</label>
                  <div className="relative">
                    {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
                    <input
                      type="number" min="0" step="0.01"
                      value={fees[key as keyof typeof fees]}
                      onChange={e => setFees(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                      className={`form-input ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-7' : ''}`}
                    />
                    {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={saveFees} disabled={savingFees} className="btn-primary w-full justify-center mb-5">
              {savingFees ? 'Saving…' : 'Save Fee Summary'}
            </button>

            {/* Calculated breakdown */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-0.5">
              <SummaryRow label="Direct Costs"       value={fmt(directTotal)} />
              <SummaryRow label={`Overhead (${fees.overheadPercent}%)`} value={fmt(overheadAmount)} />
              <SummaryRow label="Consulting Fee"     value={fmt(fees.consultingFee)} />
              <SummaryRow label="PM Fee"             value={fmt(fees.projectManagementFee)} />
              <SummaryRow label="Contingency"        value={fmt(fees.contingencyAmount)} />
              <SummaryRow label="Tax"                value={fmt(fees.taxAmount)} />
              <div className="border-t-2 border-gray-300 mt-2 pt-2 flex justify-between font-bold text-sm">
                <span className="text-blue-700">Grand Total</span>
                <span className="text-blue-700 text-base">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Billable summary */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Billable Analysis</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Billable Costs</span>
                <span className="font-semibold text-green-700">{fmt(billableTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Non-Billable</span>
                <span className="font-semibold text-gray-700">{fmt(directTotal - billableTotal)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-500">Gross Margin</span>
                <span className={`font-bold ${margin > 20 ? 'text-green-700' : margin > 10 ? 'text-amber-600' : 'text-red-600'}`}>
                  {margin.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline edit row ──────────────────────────────────────────────────────────

function EditRow({
  form, onChange, onSave, onCancel, saving,
}: {
  form: typeof emptyLine;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <tr className="bg-blue-50/60">
      <td className="px-2 py-2">
        <select name="costCategory" value={form.costCategory} onChange={onChange}
          className="form-select text-xs py-1.5 w-full">
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input name="description" value={form.description} onChange={onChange}
          placeholder="Description" className="form-input text-xs py-1.5 w-full" />
      </td>
      <td className="px-2 py-2">
        <input name="quantity" type="number" min="0" step="any" value={form.quantity} onChange={onChange}
          className="form-input text-xs py-1.5 w-16 text-right" />
      </td>
      <td className="px-2 py-2">
        <input name="unitCost" type="number" min="0" step="0.01" value={form.unitCost} onChange={onChange}
          className="form-input text-xs py-1.5 w-24 text-right" />
      </td>
      <td className="px-2 py-2">
        <input name="markupPercent" type="number" min="0" step="0.1" value={form.markupPercent} onChange={onChange}
          className="form-input text-xs py-1.5 w-16 text-right" />
      </td>
      <td className="px-2 py-2 text-right text-xs font-semibold text-gray-600">
        {(Number(form.quantity) * Number(form.unitCost) * (1 + Number(form.markupPercent)/100)).toLocaleString('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 })}
      </td>
      <td className="px-2 py-2">
        <div className="flex justify-end gap-1">
          <button onClick={onSave} disabled={saving} className="p-1 text-green-600 hover:text-green-700 rounded">
            <CheckIcon className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
