'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ArrowRightIcon,
  TrashIcon,
  XMarkIcon,
  CameraIcon,
  PhotoIcon,
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

interface SurveyLocation {
  id:           number;
  areaName:     string | null;
  floor:        string | null;
  surveyNotes:  string | null;
  surveyedAt:   string | null;
  cameraModel:  { manufacturer: string | null; model: string | null } | null;
  images:       { id: number }[];
}

type Action = 'copy' | 'move' | 'delete';

interface Props {
  projects: ProjectOption[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function projectLabel(p: ProjectOption) {
  const parts = [p.building?.buildingName, p.building?.site?.siteName].filter(Boolean);
  return parts.length ? `${p.projectName} — ${parts.join(' · ')}` : p.projectName;
}

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

export function SurveyManagementPanel({ projects }: Props) {
  const [sourceId,    setSourceId]    = useState<number | null>(null);
  const [locations,   setLocations]   = useState<SurveyLocation[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [selected,    setSelected]    = useState<Set<number>>(new Set());
  const [action,      setAction]      = useState<Action | null>(null);
  const [targetId,    setTargetId]    = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [working,     setWorking]     = useState(false);
  const [toast,       setToast]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [filterSurveyed, setFilterSurveyed] = useState<'all' | 'surveyed' | 'pending'>('all');
  const [search, setSearch] = useState('');

  // Load locations when source project changes
  useEffect(() => {
    if (!sourceId) { setLocations([]); setSelected(new Set()); return; }
    setLoading(true);
    fetch(`/api/survey/${sourceId}`)
      .then(r => r.json())
      .then(d => {
        setLocations(d.locations ?? []);
        setSelected(new Set());
      })
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, [sourceId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const visibleLocations = locations.filter(l => {
    const matchFilter =
      filterSurveyed === 'all' ? true :
      filterSurveyed === 'surveyed' ? !!l.surveyedAt :
      !l.surveyedAt;
    const matchSearch = !search ||
      (l.areaName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.floor ?? '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const allVisibleSelected = visibleLocations.length > 0 &&
    visibleLocations.every(l => selected.has(l.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        visibleLocations.forEach(l => next.delete(l.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        visibleLocations.forEach(l => next.add(l.id));
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

  function openAction(a: Action) {
    setAction(a);
    setTargetId(null);
    setConfirmText('');
  }

  function closeModal() {
    setAction(null);
    setTargetId(null);
    setConfirmText('');
  }

  const deleteConfirmExpected = `DELETE ${selected.size}`;

  const handleSubmit = useCallback(async () => {
    if (!action) return;
    setWorking(true);
    try {
      const ids = Array.from(selected);

      if (action === 'delete') {
        const res = await fetch('/api/survey/management', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationIds: ids }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Delete failed');
        setLocations(prev => prev.filter(l => !selected.has(l.id)));
        setSelected(new Set());
        setToast({ type: 'success', msg: `Deleted ${data.deleted} location${data.deleted !== 1 ? 's' : ''}.` });
      } else {
        const res = await fetch('/api/survey/management', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, locationIds: ids, targetProjectId: targetId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `${action} failed`);

        if (action === 'move') {
          setLocations(prev => prev.filter(l => !selected.has(l.id)));
          setSelected(new Set());
          setToast({ type: 'success', msg: `Moved ${data.moved} location${data.moved !== 1 ? 's' : ''}.` });
        } else {
          setToast({ type: 'success', msg: `Copied ${data.copied} location${data.copied !== 1 ? 's' : ''} with photos.` });
        }
      }
      closeModal();
    } catch (err) {
      setToast({ type: 'error', msg: err instanceof Error ? err.message : 'Operation failed' });
    } finally {
      setWorking(false);
    }
  }, [action, selected, targetId]);

  const targetProject = projects.find(p => p.id === targetId) ?? null;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Source picker */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Source Project</h2>
        <ProjectPicker
          label="Select project to manage"
          value={sourceId}
          onChange={(id) => { setSourceId(id); setSelected(new Set()); }}
          options={projects}
          placeholder="Choose a project…"
        />
      </div>

      {/* Location table */}
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
              {loading ? 'Loading…' : `${locations.length} location${locations.length !== 1 ? 's' : ''}`}
              {someSelected && <span className="ml-2 text-blue-600">· {selected.size} selected</span>}
            </span>

            {/* Filter + search */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
                {(['all', 'surveyed', 'pending'] as const).map(f => (
                  <button key={f} onClick={() => setFilterSurveyed(f)}
                    className={`px-2.5 py-1 text-xs font-medium capitalize transition-colors ${filterSurveyed === f ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…" className="text-xs outline-none w-24 text-gray-700 placeholder-gray-400" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visibleLocations.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 italic text-center">
              {locations.length === 0 ? 'No survey locations in this project.' : 'No locations match the current filter.'}
            </p>
          ) : (
            <div>
              {visibleLocations.map((loc, idx) => (
                <div
                  key={loc.id}
                  onClick={() => toggleOne(loc.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-0
                    ${selected.has(loc.id) ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-100/60'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(loc.id)}
                    onChange={() => toggleOne(loc.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{loc.areaName ?? <span className="italic text-gray-400">Unnamed</span>}</p>
                    {(loc.floor || loc.cameraModel) && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {loc.floor && <span>Floor {loc.floor}</span>}
                        {loc.floor && loc.cameraModel && <span className="mx-1">·</span>}
                        {loc.cameraModel && (
                          <span className="flex items-center gap-1 inline-flex">
                            <CameraIcon className="w-3 h-3 inline" />
                            {[loc.cameraModel.manufacturer, loc.cameraModel.model].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {loc.images.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-gray-400">
                        <PhotoIcon className="w-3.5 h-3.5" />{loc.images.length}
                      </span>
                    )}
                    {loc.surveyedAt ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircleSolid className="w-3 h-3" />Surveyed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          {someSelected && (
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-600 border-t border-blue-700">
              <span className="text-xs font-semibold text-white flex-1">{selected.size} selected</span>
              <button onClick={() => openAction('copy')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium rounded-lg transition-colors">
                <ClipboardDocumentIcon className="w-3.5 h-3.5" />Copy to…
              </button>
              <button onClick={() => openAction('move')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium rounded-lg transition-colors">
                <ArrowRightIcon className="w-3.5 h-3.5" />Move to…
              </button>
              <button onClick={() => openAction('delete')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors">
                <TrashIcon className="w-3.5 h-3.5" />Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Copy / Move modal ───────────────────────────────────────────────── */}
      {(action === 'copy' || action === 'move') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                {action === 'copy'
                  ? <><ClipboardDocumentIcon className="w-5 h-5 text-blue-500" />Copy Locations</>
                  : <><ArrowRightIcon className="w-5 h-5 text-indigo-500" />Move Locations</>}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
            </div>

            <div className="mb-5 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-600 space-y-1">
              <p><strong>{selected.size}</strong> location{selected.size !== 1 ? 's' : ''} selected</p>
              {action === 'copy' && (
                <p className="text-xs text-gray-400">Photos will be copied. The original locations are unchanged.</p>
              )}
              {action === 'move' && (
                <p className="text-xs text-gray-400">Locations will be removed from the source project.</p>
              )}
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
                onClick={handleSubmit}
                disabled={!targetId || working}
                className={`flex-1 text-sm font-semibold text-white rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-40
                  ${action === 'copy' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {working && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {working ? (action === 'copy' ? 'Copying…' : 'Moving…') : (action === 'copy' ? 'Copy' : 'Move')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ────────────────────────────────────────────────────── */}
      {action === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete Locations</h3>
                <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
              </div>
              <button onClick={closeModal} className="ml-auto text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
            </div>

            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-5">
              Permanently delete <strong>{selected.size}</strong> location{selected.size !== 1 ? 's' : ''} and all their photos.
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Type <span className="font-mono font-bold text-gray-700">{deleteConfirmExpected}</span> to confirm
              </label>
              <input
                autoFocus
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && confirmText === deleteConfirmExpected) handleSubmit(); }}
                placeholder={deleteConfirmExpected}
                className="input-field w-full text-sm font-mono"
              />
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={closeModal} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={confirmText !== deleteConfirmExpected || working}
                className="flex-1 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              >
                {working && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {working ? 'Deleting…' : 'Delete'}
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
