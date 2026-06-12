'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon,
  LockClosedIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

interface ArtifactType {
  id:   number;
  name: string;
}

interface MethodItem {
  artifactTypeId: number;
  quantity:       number;
  notes:          string;
}

interface AccessMethod {
  id:       number;
  name:     string;
  grouping: string | null;
  items:    {
    artifactTypeId: number;
    quantity:       number;
    notes:          string | null;
    artifactType:   { id: number; name: string };
  }[];
}

const GROUPINGS = ['Internal', 'External', 'Other'];

export function AccessMethodManager() {
  const [methods, setMethods] = useState<AccessMethod[]>([]);
  const [types,   setTypes]   = useState<ArtifactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editName,     setEditName]     = useState('');
  const [editGrouping, setEditGrouping] = useState('');
  const [editItems,    setEditItems]    = useState<MethodItem[]>([]);
  const [dirty,        setDirty]        = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newGrouping, setNewGrouping] = useState('Other');

  useEffect(() => {
    Promise.all([
      fetch('/api/access-methods').then(r => r.json()),
      fetch('/api/artifact-types').then(r => r.json()),
    ])
      .then(([m, t]) => {
        setMethods(Array.isArray(m) ? m : []);
        setTypes(Array.isArray(t) ? t : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function typeName(id: number) {
    return types.find(t => t.id === id)?.name ?? `Type #${id}`;
  }

  function toggleExpand(m: AccessMethod) {
    if (expandedId === m.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(m.id);
    setEditName(m.name);
    setEditGrouping(m.grouping ?? '');
    setEditItems(m.items.map(i => ({
      artifactTypeId: i.artifactTypeId,
      quantity:       i.quantity,
      notes:          i.notes ?? '',
    })));
    setDirty(false);
    setError(null);
  }

  function updateItem(idx: number, patch: Partial<MethodItem>) {
    setEditItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setDirty(true);
  }

  function removeItem(idx: number) {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function addItem() {
    const used = new Set(editItems.map(i => i.artifactTypeId));
    const firstFree = types.find(t => !used.has(t.id));
    if (!firstFree) return;
    setEditItems(prev => [...prev, { artifactTypeId: firstFree.id, quantity: 1, notes: '' }]);
    setDirty(true);
  }

  async function saveMethod(methodId: number) {
    if (!editName.trim()) {
      setError('Name is required');
      return;
    }
    const ids = editItems.map(i => i.artifactTypeId);
    if (new Set(ids).size !== ids.length) {
      setError('Each artifact type may only appear once per method');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/access-methods/${methodId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:     editName.trim(),
        grouping: editGrouping || null,
        items:    editItems,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      setError(err.error || 'Request failed');
      return;
    }
    const saved: AccessMethod = await res.json();
    setMethods(prev => prev.map(m => (m.id === saved.id ? saved : m)));
    setDirty(false);
  }

  async function deleteMethod(m: AccessMethod) {
    if (!confirm(`Delete access method "${m.name}"? If it is used on surveys it will be hidden instead.`)) return;
    setSaving(true);
    const res = await fetch(`/api/access-methods/${m.id}`, { method: 'DELETE' });
    setSaving(false);
    if (res.ok) {
      setMethods(prev => prev.filter(x => x.id !== m.id));
      if (expandedId === m.id) setExpandedId(null);
    }
  }

  async function createMethod() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/access-methods', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newName.trim(), grouping: newGrouping }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      setError(err.error || 'Request failed');
      return;
    }
    const saved: AccessMethod = await res.json();
    setMethods(prev => [...prev, { ...saved, items: saved.items ?? [] }]);
    setNewName('');
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LockClosedIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Access Methods</h2>
          {!loading && <span className="text-xs text-gray-400">({methods.length})</span>}
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-secondary text-xs">
            <PlusIcon className="w-3.5 h-3.5" /> Add Method
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {creating && (
        <div className="card p-4 bg-blue-50/60 flex items-center gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createMethod(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="Method name (e.g., Turnstile)"
            className="form-input text-sm py-1.5 flex-1"
            autoFocus
          />
          <select
            value={newGrouping}
            onChange={e => setNewGrouping(e.target.value)}
            className="form-select text-sm py-1.5 w-32"
          >
            {GROUPINGS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <button onClick={createMethod} disabled={saving || !newName.trim()} className="btn-primary text-xs">
            Create
          </button>
          <button onClick={() => setCreating(false)} className="p-1 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : (
        <div className="space-y-2">
          {GROUPINGS.map(group => {
            const grouped = methods.filter(m => (m.grouping ?? 'Other') === group);
            if (grouped.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 mt-3">
                  {group}
                </p>
                <div className="space-y-1.5">
                  {grouped.map(m => (
                    <div key={m.id} className="card overflow-hidden">
                      <button
                        onClick={() => toggleExpand(m)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                      >
                        {expandedId === m.id
                          ? <ChevronDownIcon className="w-4 h-4 text-gray-400 shrink-0" />
                          : <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />}
                        <span className="text-sm font-medium text-gray-800 flex-1">{m.name}</span>
                        <span className="text-xs text-gray-400">
                          {m.items.length} item{m.items.length === 1 ? '' : 's'}
                        </span>
                      </button>

                      {expandedId === m.id && (
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                              <label className="form-label text-xs">Name</label>
                              <input
                                value={editName}
                                onChange={e => { setEditName(e.target.value); setDirty(true); }}
                                className="form-input text-sm py-1.5"
                              />
                            </div>
                            <div>
                              <label className="form-label text-xs">Grouping</label>
                              <select
                                value={editGrouping}
                                onChange={e => { setEditGrouping(e.target.value); setDirty(true); }}
                                className="form-select text-sm py-1.5"
                              >
                                {GROUPINGS.map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="form-label text-xs mb-0">Default Bill of Materials</label>
                              <button onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                                + Add Item
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {editItems.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <select
                                    value={item.artifactTypeId}
                                    onChange={e => updateItem(idx, { artifactTypeId: Number(e.target.value) })}
                                    className="form-select text-sm py-1.5 flex-1"
                                  >
                                    {types.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="number" min="1"
                                    value={item.quantity}
                                    onChange={e => updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                                    className="form-input text-sm py-1.5 w-16 text-center"
                                  />
                                  <input
                                    value={item.notes}
                                    onChange={e => updateItem(idx, { notes: e.target.value })}
                                    placeholder="Notes"
                                    className="form-input text-sm py-1.5 flex-1"
                                  />
                                  <button onClick={() => removeItem(idx)}
                                    className="p-1 text-gray-400 hover:text-red-500 shrink-0">
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              {editItems.length === 0 && (
                                <p className="text-xs text-gray-400 py-2">No items — add the default equipment for this door type.</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={() => deleteMethod(m)}
                              className="text-xs text-red-500 hover:text-red-600 font-medium"
                            >
                              Delete Method
                            </button>
                            <button
                              onClick={() => saveMethod(m.id)}
                              disabled={saving || !dirty}
                              className="btn-primary text-xs disabled:opacity-40"
                            >
                              {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {methods.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No access methods defined.</p>
          )}
        </div>
      )}
    </div>
  );
}
