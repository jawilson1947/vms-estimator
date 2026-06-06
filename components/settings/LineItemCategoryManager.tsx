'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusIcon, PencilSquareIcon, TrashIcon,
  CheckIcon, XMarkIcon, TagIcon,
} from '@heroicons/react/24/outline';

interface Category {
  id:        number;
  name:      string;
  sortOrder: number;
  active:    boolean;
}

export function LineItemCategoryManager() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,     setLoading]   = useState(true);
  const [editId,      setEditId]    = useState<number | 'new' | null>(null);
  const [editName,    setEditName]  = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/line-item-categories')
      .then(r => r.json())
      .then((data: Category[]) => { setCategories(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function beginEdit(cat: Category) {
    setEditId(cat.id);
    setEditName(cat.name);
    setError(null);
  }

  function beginNew() {
    setEditId('new');
    setEditName('');
    setError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName('');
    setError(null);
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    setError(null);
    const isNew = editId === 'new';
    const url    = isNew ? '/api/line-item-categories' : `/api/line-item-categories/${editId}`;
    const res    = await fetch(url, {
      method:  isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: editName.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      setError(err.error || 'Request failed');
      return;
    }
    const saved: Category = await res.json();
    setCategories(prev =>
      isNew ? [...prev, saved] : prev.map(c => c.id === saved.id ? saved : c)
    );
    setEditId(null);
    setEditName('');
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    const res = await fetch(`/api/line-item-categories/${deleteTarget.id}`, { method: 'DELETE' });
    setSaving(false);
    if (res.ok) {
      setCategories(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    }
  }

  const inputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Line Item Categories</h2>
          {!loading && (
            <span className="text-xs text-gray-400">({categories.length})</span>
          )}
        </div>
        {editId !== 'new' && (
          <button onClick={beginNew} className="btn-secondary text-xs">
            <PlusIcon className="w-3.5 h-3.5" /> Add Category
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {categories.map(cat =>
                editId === cat.id ? (
                  <tr key={cat.id} className="bg-blue-50/60">
                    <td className="px-4 py-2.5" colSpan={2}>
                      <div className="flex items-center gap-2">
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={inputKeyDown}
                          className="form-input text-sm py-1.5 flex-1"
                          autoFocus
                        />
                        <button onClick={saveEdit} disabled={saving}
                          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-40">
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{cat.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => beginEdit(cat)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded">
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(cat)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {editId === 'new' && (
                <tr className="bg-blue-50/60">
                  <td className="px-4 py-2.5" colSpan={2}>
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={inputKeyDown}
                        placeholder="Category name"
                        className="form-input text-sm py-1.5 flex-1"
                        autoFocus
                      />
                      <button onClick={saveEdit} disabled={saving || !editName.trim()}
                        className="p-1 text-green-600 hover:text-green-700 disabled:opacity-40">
                        <CheckIcon className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {categories.length === 0 && editId !== 'new' && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-400">
                    No categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Category</h3>
            <p className="text-sm text-gray-600 mb-1">
              Delete <strong>{deleteTarget.name}</strong>?
            </p>
            <p className="text-xs text-gray-500 mb-5">
              This category is used on existing estimates and will be hidden rather than removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
