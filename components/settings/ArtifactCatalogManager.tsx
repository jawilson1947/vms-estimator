'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon,
  KeyIcon, PhotoIcon, CheckIcon,
} from '@heroicons/react/24/outline';

interface ArtifactType {
  id:        number;
  name:      string;
  sortOrder: number;
}

interface Artifact {
  id:             number;
  artifactTypeId: number;
  manufacturer:   string | null;
  modelName:      string | null;
  variant:        string | null;
  description:    string | null;
  imageUrl:       string | null;
  cost:           string | number | null;
  comment:        string | null;
  artifactType:   { id: number; name: string };
}

interface ArtifactFormData {
  artifactTypeId: string;
  manufacturer:   string;
  modelName:      string;
  variant:        string;
  description:    string;
  imageUrl:       string;
  cost:           string;
  comment:        string;
}

const emptyForm: ArtifactFormData = {
  artifactTypeId: '',
  manufacturer:   '',
  modelName:      '',
  variant:        '',
  description:    '',
  imageUrl:       '',
  cost:           '',
  comment:        '',
};

export function ArtifactCatalogManager() {
  const [types,     setTypes]     = useState<ArtifactType[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filterTypeId, setFilterTypeId] = useState<number | null>(null);

  const [editing,  setEditing]  = useState<Artifact | 'new' | null>(null);
  const [form,     setForm]     = useState<ArtifactFormData>(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Artifact | null>(null);

  const [addingType,  setAddingType]  = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/artifact-types').then(r => r.json()),
      fetch('/api/artifacts').then(r => r.json()),
    ])
      .then(([t, a]) => {
        setTypes(Array.isArray(t) ? t : []);
        setArtifacts(Array.isArray(a) ? a : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function beginNew() {
    setForm({ ...emptyForm, artifactTypeId: filterTypeId ? String(filterTypeId) : '' });
    setEditing('new');
    setError(null);
  }

  function beginEdit(a: Artifact) {
    setForm({
      artifactTypeId: String(a.artifactTypeId),
      manufacturer:   a.manufacturer ?? '',
      modelName:      a.modelName    ?? '',
      variant:        a.variant      ?? '',
      description:    a.description  ?? '',
      imageUrl:       a.imageUrl     ?? '',
      cost:           a.cost != null ? String(a.cost) : '',
      comment:        a.comment      ?? '',
    });
    setEditing(a);
    setError(null);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/artifacts/upload-image', { method: 'POST', body: fd });
    setUploading(false);
    if (!res.ok) {
      setError('Image upload failed');
      return;
    }
    const { url } = await res.json();
    setForm(prev => ({ ...prev, imageUrl: url }));
  }

  async function saveArtifact() {
    if (!form.artifactTypeId) {
      setError('Artifact type is required');
      return;
    }
    setSaving(true);
    setError(null);
    const isNew = editing === 'new';
    const url   = isNew ? '/api/artifacts' : `/api/artifacts/${(editing as Artifact).id}`;
    const res   = await fetch(url, {
      method:  isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      setError(err.error || 'Request failed');
      return;
    }
    const saved: Artifact = await res.json();
    setArtifacts(prev =>
      isNew ? [...prev, saved] : prev.map(a => (a.id === saved.id ? saved : a))
    );
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    const res = await fetch(`/api/artifacts/${deleteTarget.id}`, { method: 'DELETE' });
    setSaving(false);
    if (res.ok) {
      setArtifacts(prev => prev.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  }

  async function addType() {
    if (!newTypeName.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/artifact-types', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newTypeName.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      setError(err.error || 'Request failed');
      return;
    }
    const saved: ArtifactType = await res.json();
    setTypes(prev => [...prev, saved]);
    setNewTypeName('');
    setAddingType(false);
  }

  const visible = filterTypeId
    ? artifacts.filter(a => a.artifactTypeId === filterTypeId)
    : artifacts;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Artifact Catalog</h2>
          {!loading && <span className="text-xs text-gray-400">({artifacts.length})</span>}
        </div>
        <div className="flex items-center gap-2">
          {addingType ? (
            <div className="flex items-center gap-1">
              <input
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addType(); if (e.key === 'Escape') setAddingType(false); }}
                placeholder="New type name"
                className="form-input text-xs py-1.5 w-40"
                autoFocus
              />
              <button onClick={addType} disabled={saving || !newTypeName.trim()}
                className="p-1 text-green-600 hover:text-green-700 disabled:opacity-40">
                <CheckIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setAddingType(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingType(true)} className="btn-secondary text-xs">
              <PlusIcon className="w-3.5 h-3.5" /> Add Type
            </button>
          )}
          <button onClick={beginNew} className="btn-primary text-xs">
            <PlusIcon className="w-3.5 h-3.5" /> Add Artifact
          </button>
        </div>
      </div>

      {error && !editing && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Type filter chips */}
      {!loading && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterTypeId(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterTypeId === null
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            All
          </button>
          {types.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTypeId(filterTypeId === t.id ? null : t.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterTypeId === t.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No artifacts yet. Add catalog items so they can be selected in cost estimates.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Manufacturer</th>
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium">Variant</th>
                <th className="px-4 py-2 font-medium text-right">Cost</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-700">
                    <div className="flex items-center gap-2">
                      {a.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center shrink-0">
                          <PhotoIcon className="w-4 h-4 text-gray-300" />
                        </span>
                      )}
                      {a.artifactType.name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{a.manufacturer ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.modelName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.variant ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">
                    {a.cost != null ? `$${Number(a.cost).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => beginEdit(a)}
                        className="p-1 text-gray-400 hover:text-blue-600 rounded">
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(a)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit / new modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {editing === 'new' ? 'Add Artifact' : 'Edit Artifact'}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="form-label">Artifact Type <span className="text-red-500">*</span></label>
                <select
                  name="artifactTypeId" value={form.artifactTypeId} onChange={handleChange}
                  className="form-select"
                >
                  <option value="">— Select a type —</option>
                  {types.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Manufacturer</label>
                  <input name="manufacturer" value={form.manufacturer} onChange={handleChange}
                    className="form-input" placeholder="Isonas" />
                </div>
                <div>
                  <label className="form-label">Model</label>
                  <input name="modelName" value={form.modelName} onChange={handleChange}
                    className="form-input" placeholder="RC-04" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Variant</label>
                  <input name="variant" value={form.variant} onChange={handleChange}
                    className="form-input" placeholder="PRX / 600lbs / 10 ft" />
                </div>
                <div>
                  <label className="form-label">Cost ($)</label>
                  <input name="cost" type="number" min="0" step="0.01"
                    value={form.cost} onChange={handleChange}
                    className="form-input" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea name="description" rows={2} value={form.description} onChange={handleChange}
                  className="form-input resize-none" />
              </div>

              <div>
                <label className="form-label">Image</label>
                <div className="flex items-center gap-3">
                  {form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                  ) : (
                    <span className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                      <PhotoIcon className="w-6 h-6 text-gray-300" />
                    </span>
                  )}
                  <label className="btn-secondary text-xs cursor-pointer">
                    {uploading ? 'Uploading…' : form.imageUrl ? 'Replace Image' : 'Upload Image'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  {form.imageUrl && (
                    <button
                      onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label">Comment</label>
                <textarea name="comment" rows={2} value={form.comment} onChange={handleChange}
                  className="form-input resize-none" />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveArtifact} disabled={saving || uploading} className="btn-primary">
                {saving ? 'Saving…' : 'Save Artifact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Artifact</h3>
            <p className="text-sm text-gray-600 mb-1">
              Delete <strong>
                {[deleteTarget.manufacturer, deleteTarget.modelName, deleteTarget.variant]
                  .filter(Boolean).join(' ') || deleteTarget.artifactType.name}
              </strong>?
            </p>
            <p className="text-xs text-gray-500 mb-5">
              If this artifact is used on existing estimates it will be hidden rather than removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
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
