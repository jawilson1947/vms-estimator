'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

interface GeneralItem {
  id:          number;
  name:        string;
  description: string | null;
  cost:        string | number;
  defaultQty:  string | number;
  sortOrder:   number;
  active:      boolean;
}

interface FormState {
  name:        string;
  description: string;
  cost:        string;
  defaultQty:  string;
}

const emptyForm: FormState = { name: '', description: '', cost: '0.00', defaultQty: '1' };

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export function GeneralItemManager() {
  const [items, setItems]     = useState<GeneralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState<number | 'new' | null>(null);
  const [form, setForm]       = useState<FormState>(emptyForm);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/general-items?all=1');
      setItems(res.ok ? await res.json() : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setForm(emptyForm);
    setEditId('new');
    setError('');
  }

  function startEdit(item: GeneralItem) {
    setForm({
      name:        item.name,
      description: item.description ?? '',
      cost:        String(Number(item.cost).toFixed(2)),
      defaultQty:  String(Number(item.defaultQty)),
    });
    setEditId(item.id);
    setError('');
  }

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const isNew = editId === 'new';
      const res = await fetch(isNew ? '/api/general-items' : `/api/general-items/${editId}`, {
        method:  isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name,
          description: form.description,
          cost:        parseFloat(form.cost) || 0,
          defaultQty:  parseFloat(form.defaultQty) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: GeneralItem) {
    await fetch(`/api/general-items/${item.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: !item.active }),
    });
    await load();
  }

  async function remove(item: GeneralItem) {
    if (!confirm(`Delete "${item.name}"? If it's assigned to any survey locations it will be deactivated instead.`)) return;
    await fetch(`/api/general-items/${item.id}`, { method: 'DELETE' });
    await load();
  }

  const editorCells = (
    <>
      <td className="py-2 pl-2 pr-2">
        <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Item name" className="form-input text-xs w-full" />
      </td>
      <td className="py-2 px-2">
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Description (optional)" className="form-input text-xs w-full" />
      </td>
      <td className="py-2 px-2">
        <input type="number" min="0" step="0.01" value={form.cost}
          onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
          className="form-input text-xs w-24 text-right" />
      </td>
      <td className="py-2 px-2">
        <input type="number" min="0.01" step="0.01" value={form.defaultQty}
          onChange={e => setForm(f => ({ ...f, defaultQty: e.target.value }))}
          className="form-input text-xs w-16 text-right" />
      </td>
      <td className="py-2 px-2" />
      <td className="py-2 pl-2 pr-2 text-right whitespace-nowrap">
        <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:text-green-800" title="Save">
          <CheckIcon className="w-4 h-4" />
        </button>
        <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </td>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
        <button onClick={startNew} disabled={editId !== null} className="btn-primary text-xs gap-1.5">
          <PlusIcon className="w-4 h-4" /> Add Item
        </button>
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-2 pl-2 pr-2 font-medium">Name</th>
              <th className="text-left py-2 px-2 font-medium">Description</th>
              <th className="text-right py-2 px-2 font-medium">Unit Cost</th>
              <th className="text-right py-2 px-2 font-medium">Default Qty</th>
              <th className="text-left py-2 px-2 font-medium">Status</th>
              <th className="py-2 pl-2 pr-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {editId === 'new' && <tr className="bg-blue-50/60">{editorCells}</tr>}
            {items.map(item => (
              editId === item.id ? (
                <tr key={item.id} className="bg-blue-50/60">{editorCells}</tr>
              ) : (
                <tr key={item.id} className={`hover:bg-gray-50 ${!item.active ? 'opacity-50' : ''}`}>
                  <td className="py-2 pl-2 pr-2 font-medium text-gray-900">{item.name}</td>
                  <td className="py-2 px-2 text-gray-500">{item.description || '—'}</td>
                  <td className="py-2 px-2 text-right text-gray-700">{fmt(Number(item.cost))}</td>
                  <td className="py-2 px-2 text-right text-gray-700">{Number(item.defaultQty)}</td>
                  <td className="py-2 px-2">
                    <button onClick={() => toggleActive(item)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-2 pl-2 pr-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(item)} disabled={editId !== null}
                      className="p-1 text-gray-400 hover:text-blue-600" title="Edit">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(item)} disabled={editId !== null}
                      className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            ))}
            {items.length === 0 && editId !== 'new' && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400 italic">No items yet — add your first catalog item.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
