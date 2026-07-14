'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectOption {
  id:          number;
  projectName: string;
  building:    { buildingName: string; site: { siteName: string } | null } | null;
}

interface CostLine {
  id:               number;
  categoryId:       number;
  category:         { name: string } | null;
  description:      string | null;
  quantity:         string | number;
  unitCost:         string | number;
  markupPercent:    string | number;
  lineTotal:        string | number | null;
  vendor:           string | null;
  surveyLocationId: number | null;
}

interface Props {
  projects: ProjectOption[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function projectLabel(p: ProjectOption) {
  const parts = [p.building?.buildingName, p.building?.site?.siteName].filter(Boolean);
  return parts.length ? `${p.projectName} — ${parts.join(' · ')}` : p.projectName;
}

const fmtMoney = (v: string | number | null | undefined) =>
  Number(v ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// ── Project picker dropdown ───────────────────────────────────────────────────

function ProjectPicker({
  label,
  value,
  onChange,
  options,
  exclude,
  placeholder,
}: {
  label:       string;
  value:       number | null;
  onChange:    (id: number | null) => void;
  options:     ProjectOption[];
  exclude?:    number | null;
  placeholder: string;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(p =>
    p.id !== exclude &&
    (!search || p.projectName.toLowerCase().includes(search.toLowerCase()) ||
     (p.building?.buildingName ?? '').toLowerCase().includes(search.toLowerCase()) ||
     (p.building?.site?.siteName ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const selected = options.find(p => p.id === value) ?? null;

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-left hover:border-blue-400 transition-colors shadow-sm"
      >
        <span className={selected ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
          {selected ? projectLabel(selected) : placeholder}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400 italic">No projects found.</p>
          ) : filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.id); setOpen(false); setSearch(''); }}
              className={`w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${value === p.id ? 'bg-blue-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{p.projectName}</p>
                {p.building && (
                  <p className="text-xs text-gray-400 truncate">
                    {[p.building.buildingName, p.building.site?.siteName].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              {value === p.id && <CheckCircleSolid className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CostManagementPanel({ projects }: Props) {
  const [sourceId,  setSourceId]  = useState<number | null>(null);
  const [costs,     setCosts]     = useState<CostLine[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [targetId,  setTargetId]  = useState<number | null>(null);
  const [working,   setWorking]   = useState(false);
  const [toast,     setToast]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [search,    setSearch]    = useState('');

  // Load cost items when source project changes.
  // Survey-linked and soft-deleted (qty 0) rows are excluded — the Survey
  // Management utility handles survey items.
  useEffect(() => {
    if (!sourceId) { setCosts([]); setSelected(new Set()); return; }
    setLoading(true);
    fetch(`/api/projects/${sourceId}/costs`)
      .then(r => r.json())
      .then((d: CostLine[]) => {
        const rows = Array.isArray(d)
          ? d.filter(c => c.surveyLocationId == null && Number(c.quantity) > 0)
          : [];
        setCosts(rows);
        setSelected(new Set());
      })
      .catch(() => setCosts([]))
      .finally(() => setLoading(false));
  }, [sourceId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const visibleCosts = costs.filter(c =>
    !search ||
    (c.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.vendor ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.category?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const allVisibleSelected = visibleCosts.length > 0 &&
    visibleCosts.every(c => selected.has(c.id));
  const someSelected = selected.size > 0;

  const selectedTotal = costs
    .filter(c => selected.has(c.id))
    .reduce((sum, c) => sum + Number(c.lineTotal ?? 0), 0);

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        visibleCosts.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        visibleCosts.forEach(c => next.add(c.id));
        return next;
      });
    }
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function closeModal() {
    setModalOpen(false);
    setTargetId(null);
  }

  const handleCopy = useCallback(async () => {
    if (!sourceId || !targetId) return;
    setWorking(true);
    try {
      const res = await fetch('/api/project-costs/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProjectId: sourceId,
          targetProjectId: targetId,
          costIds: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Copy failed');

      let msg = `Copied ${data.copied} item${data.copied !== 1 ? 's' : ''}.`;
      if (data.skipped > 0) msg += ` ${data.skipped} skipped.`;
      setToast({ type: 'success', msg });
      setSelected(new Set());
      closeModal();
    } catch (err) {
      setToast({ type: 'error', msg: err instanceof Error ? err.message : 'Copy failed' });
    } finally {
      setWorking(false);
    }
  }, [sourceId, targetId, selected]);

  const targetProject = projects.find(p => p.id === targetId) ?? null;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Source picker */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Source Project</h2>
        <ProjectPicker
          label="Select project to copy cost items from"
          value={sourceId}
          onChange={(id) => { setSourceId(id); setSelected(new Set()); }}
          options={projects}
          placeholder="Choose a project…"
        />
      </div>

      {/* Cost item table */}
      {sourceId && (
        <div className="card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allVisibleSelected; }}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-gray-500 flex-1">
              {loading ? 'Loading…' : `${costs.length} cost item${costs.length !== 1 ? 's' : ''}`}
              {someSelected && (
                <span className="ml-2 text-blue-600">
                  · {selected.size} selected · {fmtMoney(selectedTotal)}
                </span>
              )}
            </span>

            {/* Search */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg">
              <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…" className="text-xs outline-none w-28 text-gray-700 placeholder-gray-400" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visibleCosts.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 italic text-center">
              {costs.length === 0
                ? 'No copyable cost items in this project. (Survey items are managed in Survey Management.)'
                : 'No items match the current search.'}
            </p>
          ) : (
            <div>
              {visibleCosts.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => toggleOne(c.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-0
                    ${selected.has(c.id) ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-100/60'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {c.description ?? <span className="italic text-gray-400">No description</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {c.category?.name ?? 'Uncategorized'}
                      {c.vendor && <span> · {c.vendor}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <span className="text-xs text-gray-500 w-16">
                      {Number(c.quantity)} × {fmtMoney(c.unitCost)}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 w-24">
                      {fmtMoney(c.lineTotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          {someSelected && (
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-600 border-t border-blue-700">
              <span className="text-xs font-semibold text-white flex-1">
                {selected.size} selected · {fmtMoney(selectedTotal)}
              </span>
              <button onClick={() => { setModalOpen(true); setTargetId(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium rounded-lg transition-colors">
                <ClipboardDocumentIcon className="w-3.5 h-3.5" />Copy to…
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Copy modal ──────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardDocumentIcon className="w-5 h-5 text-blue-500" />Copy Cost Items
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
            </div>

            <div className="mb-5 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-600 space-y-1">
              <p>
                <strong>{selected.size}</strong> item{selected.size !== 1 ? 's' : ''} selected
                · <strong>{fmtMoney(selectedTotal)}</strong>
              </p>
              <p className="text-xs text-gray-400">
                Unit costs, markup and dates are copied as-is. The original items are unchanged.
              </p>
            </div>

            <ProjectPicker
              label="Destination project"
              value={targetId}
              onChange={setTargetId}
              options={projects}
              exclude={sourceId}
              placeholder="Choose destination…"
            />

            {targetProject && (
              <p className="mt-2 text-xs text-gray-500">
                → <strong>{targetProject.projectName}</strong>
                {targetProject.building && <> · {targetProject.building.buildingName}</>}
              </p>
            )}

            <div className="flex gap-2 mt-6">
              <button onClick={closeModal} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                onClick={handleCopy}
                disabled={!targetId || working}
                className="flex-1 text-sm font-semibold text-white rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-40 bg-blue-600 hover:bg-blue-700"
              >
                {working && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {working ? 'Copying…' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success'
            ? <CheckCircleIcon className="w-5 h-5 shrink-0" />
            : <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
