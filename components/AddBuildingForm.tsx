'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from '@heroicons/react/24/outline';

export function AddBuildingForm({ siteId }: { siteId: number }) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const res = await fetch('/api/buildings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ siteId, buildingName: name, notes }),
    });

    setSaving(false);

    if (!res.ok) { setError((await res.json()).error ?? 'Failed to add building.'); return; }

    setName('');
    setNotes('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary w-full justify-center py-3 border-dashed">
        <PlusIcon className="w-4 h-4" /> Add Building
      </button>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Building</h3>
      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="form-label">Building Name <span className="text-red-500">*</span></label>
          <input
            type="text" required value={name} onChange={e => setName(e.target.value)}
            className="form-input" placeholder="Building A — Main Office"
          />
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea
            rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            className="form-input resize-none" placeholder="Optional notes…"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Adding…' : 'Add Building'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
