'use client';

import { useState, useMemo, useEffect } from 'react';
import { PlusIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { LinkedDescription } from '@/components/LinkedDescription';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryOption {
  id:   number;
  name: string;
}

interface CameraOption {
  id:           number;
  manufacturer: string | null;
  model:        string | null;
  cost:         number | null;
}

interface CostLine {
  id:            number;
  categoryId:    number;
  categoryName:  string;
  cameraModelId: number;
  description:   string;
  quantity:      number;
  unitCost:      number;
  markupPercent: number;
  lineTotal:     number;
  vendor:        string;
  url:           string;
  billable:      boolean;
  notes:         string;
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

interface SurveyItem {
  locationId:    number;      // first location in the group (used for markup API)
  cameraModelId: number;      // group key
  description:   string;
  unitCost:      number;
  quantity:      number;
  lineTotal:     number;
}

interface SurveyOverride {
  costId:        number;
  markupPercent: number;
}

interface BomItem {
  artifactTypeId: number;     // group key
  typeName:       string;
  quantity:       number;     // aggregated across access points
  notes:          string[];
}

interface BomOverride {
  costId:          number;
  artifactModelId: number | null;
  quantity:        number;
  unitCost:        number;
  markupPercent:   number;
}

interface ArtifactOption {
  id:             number;
  artifactTypeId: number;
  manufacturer:   string | null;
  modelName:      string | null;
  variant:        string | null;
  cost:           number | null;
}

interface BomRowState {
  artifactModelId: number;    // 0 = not picked
  quantity:        number;
  unitCost:        number;
  markupPercent:   number;
}

function artifactLabel(a: ArtifactOption) {
  return [a.manufacturer, a.modelName, a.variant].filter(Boolean).join(' ') || `Artifact #${a.id}`;
}

interface Props {
  projectId:       number;
  overheadRateDefault: number;
  initialCosts:    CostLine[];
  initialSummary:  FeeSummary | null;
  surveyItems?:    SurveyItem[];
  surveyOverrides?: Record<number, SurveyOverride>;
  bomItems?:       BomItem[];
  bomOverrides?:   Record<number, BomOverride>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1','#14b8a6','#a855f7','#64748b'];

const emptyLine = {
  categoryId: 0, cameraModelId: 0, description: '', quantity: 1,
  unitCost: 0, markupPercent: 0, vendor: '', url: '', billable: true, notes: '',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CostEstimator({ projectId, overheadRateDefault, initialCosts, initialSummary, surveyItems = [], surveyOverrides = {}, bomItems = [], bomOverrides = {} }: Props) {
  const [costs, setCosts]         = useState<CostLine[]>(initialCosts);
  const [summary, setSummary]     = useState<FeeSummary | null>(initialSummary);
  const [editId, setEditId]       = useState<number | 'new' | null>(null);
  const [lineForm, setLineForm]   = useState(emptyLine);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [cameras,    setCameras]    = useState<CameraOption[]>([]);
  const [fees, setFees]           = useState({
    overheadPercent:      initialSummary?.overheadPercent      ?? overheadRateDefault,
    consultingFee:        initialSummary?.consultingFee        ?? 0,
    projectManagementFee: initialSummary?.projectManagementFee ?? 0,
    contingencyAmount:    initialSummary?.contingencyAmount    ?? 0,
    taxAmount:            initialSummary?.taxAmount            ?? 0,
  });
  const [feeDisplayValues, setFeeDisplayValues] = useState<Record<string, string>>({
    consultingFee:        fmtNum(initialSummary?.consultingFee        ?? 0),
    projectManagementFee: fmtNum(initialSummary?.projectManagementFee ?? 0),
    contingencyAmount:    fmtNum(initialSummary?.contingencyAmount    ?? 0),
    taxAmount:            fmtNum(initialSummary?.taxAmount            ?? 0),
  });
  const [savingFees, setSavingFees] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [activeTab, setActiveTab]   = useState<'items'|'chart'>('items');

  // Survey row markup — keyed by cameraModelId, seeded from DB overrides
  const [surveyMarkups, setSurveyMarkups] = useState<Record<number, number>>(
    () => Object.fromEntries(Object.entries(surveyOverrides).map(([k, v]) => [Number(k), v.markupPercent]))
  );
  const [dirtyMarkups,  setDirtyMarkups]  = useState<Record<number, string>>({});
  const [savingMarkup,  setSavingMarkup]  = useState<Record<number, boolean>>({});

  async function commitSurveyMarkup(s: SurveyItem) {
    const key = s.cameraModelId;
    const val = Number(dirtyMarkups[key]) || 0;
    setSavingMarkup(prev => ({ ...prev, [key]: true }));
    await fetch(`/api/projects/${projectId}/survey-markup`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        locationId:    s.locationId,
        markupPercent: val,
        cameraModelId: s.cameraModelId,
        description:   s.description,
        unitCost:      s.unitCost,
      }),
    });
    setSurveyMarkups(prev => ({ ...prev, [key]: val }));
    setDirtyMarkups(prev => { const n = { ...prev }; delete n[key]; return n; });
    setSavingMarkup(prev => ({ ...prev, [key]: false }));
  }

  function revertSurveyMarkup(key: number) {
    setDirtyMarkups(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  // ── Access Control BOM rows — keyed by artifactTypeId ──────────────────────
  const [artifacts, setArtifacts] = useState<ArtifactOption[]>([]);
  const [bomState, setBomState] = useState<Record<number, BomRowState>>(() => {
    const out: Record<number, BomRowState> = {};
    for (const item of bomItems) {
      const ov = bomOverrides[item.artifactTypeId];
      out[item.artifactTypeId] = ov
        ? { artifactModelId: ov.artifactModelId ?? 0, quantity: item.quantity, unitCost: ov.unitCost, markupPercent: ov.markupPercent }
        : { artifactModelId: 0, quantity: item.quantity, unitCost: 0, markupPercent: 0 };
    }
    return out;
  });
  // Committed snapshot per type — drives totals; undefined until first commit
  const [bomSaved, setBomSaved] = useState<Record<number, BomRowState>>(() => {
    const out: Record<number, BomRowState> = {};
    for (const [key, ov] of Object.entries(bomOverrides)) {
      out[Number(key)] = { artifactModelId: ov.artifactModelId ?? 0, quantity: ov.quantity, unitCost: ov.unitCost, markupPercent: ov.markupPercent };
    }
    return out;
  });
  const [savingBom, setSavingBom] = useState<Record<number, boolean>>({});

  function bomRowDirty(typeId: number) {
    const cur = bomState[typeId];
    const saved = bomSaved[typeId];
    if (!cur) return false;
    if (!saved) return cur.artifactModelId !== 0 || cur.markupPercent !== 0;
    return cur.artifactModelId !== saved.artifactModelId
      || cur.quantity      !== saved.quantity
      || cur.unitCost      !== saved.unitCost
      || cur.markupPercent !== saved.markupPercent;
  }

  function updateBomRow(typeId: number, patch: Partial<BomRowState>) {
    setBomState(prev => ({ ...prev, [typeId]: { ...prev[typeId], ...patch } }));
  }

  function pickBomModel(typeId: number, modelId: number) {
    const model = artifacts.find(a => a.id === modelId);
    updateBomRow(typeId, {
      artifactModelId: modelId,
      unitCost: model?.cost != null ? Number(model.cost) : 0,
    });
  }

  async function commitBomRow(item: BomItem) {
    const key = item.artifactTypeId;
    const st  = bomState[key];
    if (!st) return;
    const model = artifacts.find(a => a.id === st.artifactModelId);
    setSavingBom(prev => ({ ...prev, [key]: true }));
    const res = await fetch(`/api/projects/${projectId}/access-bom`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        artifactTypeId:  key,
        artifactModelId: st.artifactModelId || null,
        quantity:        st.quantity,
        unitCost:        st.unitCost,
        markupPercent:   st.markupPercent,
        description:     model ? `${item.typeName} — ${artifactLabel(model)}` : item.typeName,
      }),
    });
    setSavingBom(prev => ({ ...prev, [key]: false }));
    if (res.ok) setBomSaved(prev => ({ ...prev, [key]: { ...st } }));
  }

  function revertBomRow(item: BomItem) {
    const saved = bomSaved[item.artifactTypeId];
    setBomState(prev => ({
      ...prev,
      [item.artifactTypeId]: saved
        ? { ...saved, quantity: item.quantity }
        : { artifactModelId: 0, quantity: item.quantity, unitCost: 0, markupPercent: 0 },
    }));
  }

  useEffect(() => {
    fetch('/api/line-item-categories')
      .then(r => r.json())
      .then((data: CategoryOption[]) => setCategories(data))
      .catch(() => {});
    fetch('/api/cameras')
      .then(r => r.json())
      .then((data: CameraOption[]) => setCameras(data))
      .catch(() => {});
    if (bomItems.length > 0) {
      fetch('/api/artifacts')
        .then(r => r.json())
        .then((data: ArtifactOption[]) => setArtifacts(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived totals ──────────────────────────────────────────────────────────
  const surveyTotal   = useMemo(
    () => surveyItems.reduce((s, i) => {
      const markup = surveyMarkups[i.cameraModelId] ?? 0;
      return s + i.unitCost * i.quantity * (1 + markup / 100);
    }, 0),
    [surveyItems, surveyMarkups]
  );
  const bomTotal = useMemo(
    () => Object.values(bomSaved).reduce((s, r) => s + r.unitCost * r.quantity * (1 + r.markupPercent / 100), 0),
    [bomSaved]
  );
  const directTotal   = useMemo(() => costs.reduce((s, c) => s + c.lineTotal, 0) + surveyTotal + bomTotal, [costs, surveyTotal, bomTotal]);

  const overheadAmount  = directTotal * (fees.overheadPercent / 100);
  const grandTotal      = directTotal + overheadAmount + fees.consultingFee + fees.projectManagementFee + fees.contingencyAmount + fees.taxAmount;
  const billableTotal   = costs.filter(c => c.billable).reduce((s, c) => s + c.lineTotal, 0) + surveyTotal + bomTotal;
  const margin          = grandTotal > 0 ? ((grandTotal - directTotal) / grandTotal) * 100 : 0;

  // ── Category totals for charts ──────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    costs.forEach(c => { map[c.categoryName] = (map[c.categoryName] ?? 0) + c.lineTotal; });
    if (surveyTotal > 0) map['Camera'] = (map['Camera'] ?? 0) + surveyTotal;
    if (bomTotal > 0)    map['Access Control'] = (map['Access Control'] ?? 0) + bomTotal;
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [costs, surveyTotal, bomTotal]);

  // ── Line item CRUD ──────────────────────────────────────────────────────────
  function startNew()        { setLineForm({ ...emptyLine, categoryId: categories[0]?.id ?? 0 }); setEditId('new'); }
  function startEdit(c: CostLine) {
    setLineForm({
      categoryId: c.categoryId, cameraModelId: c.cameraModelId, description: c.description,
      quantity: c.quantity, unitCost: c.unitCost, markupPercent: c.markupPercent,
      vendor: c.vendor, url: c.url, billable: c.billable, notes: c.notes,
    });
    setEditId(c.id);
  }
  function cancelEdit() { setEditId(null); }

  function handleLineChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, type, value } = e.target;
    setLineForm(prev => {
      const next: typeof prev = {
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked
              : name === 'categoryId' ? Number(value)
              : value,
      };
      // Clear camera link when switching away from Camera Equipment
      if (name === 'categoryId') {
        const catName = categories.find(c => c.id === Number(value))?.name;
        if (catName !== 'Camera Equipment') next.cameraModelId = 0;
      }
      return next;
    });
  }

  function handleCameraChange(cameraId: number) {
    const cam = cameras.find(c => c.id === cameraId);
    setLineForm(prev => ({
      ...prev,
      cameraModelId: cameraId,
      description:   cam ? [cam.manufacturer, cam.model].filter(Boolean).join(' ') : prev.description,
      unitCost:      cam?.cost ? Number(cam.cost) : prev.unitCost,
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
    const raw = await res.json();
    const saved: CostLine = {
      id:            raw.id,
      categoryId:    raw.categoryId,
      categoryName:  raw.category?.name ?? '',
      cameraModelId: raw.cameraModelId  ?? 0,
      description:   raw.description   ?? '',
      quantity:      Number(raw.quantity),
      unitCost:      Number(raw.unitCost),
      markupPercent: Number(raw.markupPercent),
      lineTotal:     Number(raw.lineTotal ?? 0),
      vendor:        raw.vendor   ?? '',
      url:           raw.url      ?? '',
      billable:      raw.billable,
      notes:         raw.notes    ?? '',
    };
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
                          onSave={saveLine} onCancel={cancelEdit} saving={savingLine}
                          categories={categories} cameras={cameras} onCameraChange={handleCameraChange} />
                      ) : (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <span className="badge bg-gray-100 text-gray-600 text-xs whitespace-nowrap">
                              {c.categoryName}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            <LinkedDescription description={c.description} url={c.url} />
                          </td>
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

                    {surveyItems.map(s => {
                      const key       = s.cameraModelId;
                      const saved     = surveyMarkups[key] ?? 0;
                      const inputVal  = key in dirtyMarkups ? dirtyMarkups[key] : String(saved);
                      const isDirty   = key in dirtyMarkups && Number(dirtyMarkups[key]) !== saved;
                      const isSaving  = savingMarkup[key] ?? false;
                      const markup    = isDirty ? (Number(dirtyMarkups[key]) || 0) : saved;
                      const lineTotal = s.unitCost * s.quantity * (1 + markup / 100);
                      return (
                        <tr key={`survey-${key}`} className="hover:bg-indigo-50/30">
                          <td className="px-3 py-2">
                            <span className="badge bg-indigo-100 text-indigo-700 text-xs whitespace-nowrap">Camera</span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            <div>{s.description}</div>
                            {s.quantity > 1 && (
                              <div className="text-xs text-gray-400 mt-0.5">{s.quantity} locations</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{s.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{fmt(s.unitCost)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number" min="0" step="0.1"
                                value={inputVal}
                                onChange={e => setDirtyMarkups(prev => ({ ...prev, [key]: e.target.value }))}
                                className="form-input text-xs py-0.5 w-16 text-right"
                              />
                              {isDirty && (
                                <>
                                  <button onClick={() => commitSurveyMarkup(s)} disabled={isSaving}
                                    className="p-1 text-green-600 hover:text-green-700 rounded">
                                    <CheckIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => revertSurveyMarkup(key)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(lineTotal)}</td>
                          <td className="px-3 py-2" />
                        </tr>
                      );
                    })}

                    {bomItems.map(item => {
                      const key      = item.artifactTypeId;
                      const st       = bomState[key] ?? { artifactModelId: 0, quantity: item.quantity, unitCost: 0, markupPercent: 0 };
                      const isDirty  = bomRowDirty(key);
                      const isSaving = savingBom[key] ?? false;
                      const typeModels = artifacts.filter(a => a.artifactTypeId === key);
                      const lineTotal  = st.unitCost * st.quantity * (1 + st.markupPercent / 100);
                      return (
                        <tr key={`bom-${key}`} className="hover:bg-violet-50/30">
                          <td className="px-3 py-2">
                            <span className="badge bg-violet-100 text-violet-700 text-xs whitespace-nowrap">Access Control</span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            <div>{item.typeName}</div>
                            <select
                              value={st.artifactModelId}
                              onChange={e => pickBomModel(key, Number(e.target.value))}
                              className="form-select text-xs py-1 w-full mt-1"
                            >
                              <option value={0}>-- Select model --</option>
                              {typeModels.map(a => (
                                <option key={a.id} value={a.id}>
                                  {artifactLabel(a)}{a.cost != null ? ` -- $${Number(a.cost).toFixed(2)}` : ''}
                                </option>
                              ))}
                            </select>
                            {st.artifactModelId === 0 && (
                              <div className="text-xs text-amber-600 mt-0.5">Pick a model to price this item</div>
                            )}
                            {item.notes.map((n, i) => (
                              <div key={i} className="text-xs text-gray-400 mt-0.5 italic">{n}</div>
                            ))}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number" min="0" step="1"
                              value={st.quantity}
                              onChange={e => updateBomRow(key, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                              className="form-input text-xs py-0.5 w-14 text-right"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{fmt(st.unitCost)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number" min="0" step="0.1"
                                value={st.markupPercent}
                                onChange={e => updateBomRow(key, { markupPercent: Number(e.target.value) || 0 })}
                                className="form-input text-xs py-0.5 w-16 text-right"
                              />
                              {isDirty && (
                                <>
                                  <button onClick={() => commitBomRow(item)} disabled={isSaving}
                                    className="p-1 text-green-600 hover:text-green-700 rounded">
                                    <CheckIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => revertBomRow(item)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(lineTotal)}</td>
                          <td className="px-3 py-2" />
                        </tr>
                      );
                    })}

                    {editId === 'new' && (
                      <EditRow form={lineForm} onChange={handleLineChange}
                        onSave={saveLine} onCancel={cancelEdit} saving={savingLine}
                        categories={categories} cameras={cameras} onCameraChange={handleCameraChange} />
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
                    {prefix ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={feeDisplayValues[key]}
                        onChange={e => setFeeDisplayValues(prev => ({ ...prev, [key]: e.target.value }))}
                        onBlur={e => {
                          const num = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                          setFees(prev => ({ ...prev, [key]: num }));
                          setFeeDisplayValues(prev => ({ ...prev, [key]: fmtNum(num) }));
                        }}
                        className="form-input pl-6"
                      />
                    ) : (
                      <input
                        type="number" min="0" step="0.01"
                        value={fees[key as keyof typeof fees]}
                        onChange={e => setFees(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        className={`form-input ${suffix ? 'pr-7' : ''}`}
                      />
                    )}
                    {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={saveFees} disabled={savingFees} className="btn-primary w-full justify-center mb-5">
              {savingFees ? 'Saving...' : 'Save Fee Summary'}
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
  form, onChange, onSave, onCancel, saving, categories, cameras, onCameraChange,
}: {
  form:             typeof emptyLine;
  onChange:         (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSave:           () => void;
  onCancel:         () => void;
  saving:           boolean;
  categories:       CategoryOption[];
  cameras:          CameraOption[];
  onCameraChange:   (cameraId: number) => void;
}) {
  const isCameraEquipment = categories.find(c => c.id === form.categoryId)?.name === 'Camera Equipment';

  return (
    <tr className="bg-blue-50/60">
      <td className="px-2 py-2">
        <select name="categoryId" value={form.categoryId} onChange={onChange}
          className="form-select text-xs py-1.5 w-full">
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        {isCameraEquipment ? (
          <select
            value={form.cameraModelId}
            onChange={e => onCameraChange(Number(e.target.value))}
            className="form-select text-xs py-1.5 w-full"
          >
            <option value={0}>-- Select camera --</option>
            {cameras.map(cam => (
              <option key={cam.id} value={cam.id}>
                {[cam.manufacturer, cam.model].filter(Boolean).join(' ')}
                {cam.cost ? ` -- $${Number(cam.cost).toFixed(2)}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input name="description" value={form.description} onChange={onChange}
              placeholder="Description" className="form-input text-xs py-1.5 w-full" />
            <input name="url" type="url" value={form.url} onChange={onChange}
              placeholder="https:// (optional link)" className="form-input text-xs py-1 w-full mt-1 text-blue-600 placeholder:text-gray-400" />
          </>
        )}
      </td>
      <td className="px-2 py-2">
        <input name="quantity" type="number" min="0" step="any" value={form.quantity} onChange={onChange}
          className="form-input text-xs py-1.5 w-16 text-right" />
      </td>
      <td className="px-2 py-2">
        {isCameraEquipment ? (
          <span className="block text-right text-xs text-gray-500 px-1">
            {form.unitCost > 0 ? fmt(form.unitCost) : '--'}
          </span>
        ) : (
          <input name="unitCost" type="number" min="0" step="0.01" value={form.unitCost} onChange={onChange}
            className="form-input text-xs py-1.5 w-24 text-right" />
        )}
      </td>
      <td className="px-2 py-2">
        <input name="markupPercent" type="number" min="0" step="0.1" value={form.markupPercent} onChange={onChange}
          className="form-input text-xs py-1.5 w-16 text-right" />
      </td>
      <td className="px-2 py-2 text-right text-xs font-semibold text-gray-600">
        {fmt(Number(form.quantity) * Number(form.unitCost) * (1 + Number(form.markupPercent)/100))}
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
