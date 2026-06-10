'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

export default function EditBuildingPage() {
  const params   = useParams<{ id: string }>();
  const router   = useRouter();
  const buildingId = Number(params.id);

  const [buildingName, setBuildingName] = useState('');
  const [notes,        setNotes]        = useState('');
  const [siteName,     setSiteName]     = useState('');
  const [siteId,       setSiteId]       = useState<number | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    fetch(`/api/buildings/${buildingId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { buildingName: string; notes: string | null; site: { id: number; siteName: string } } | null) => {
        if (!d) return;
        setBuildingName(d.buildingName);
        setNotes(d.notes ?? '');
        setSiteName(d.site.siteName);
        setSiteId(d.site.id);
      })
      .finally(() => setLoading(false));
  }, [buildingId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!buildingName.trim()) { setError('Building name is required'); return; }
    setSaving(true);
    setError('');
    const res = await fetch(`/api/buildings/${buildingId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ buildingName: buildingName.trim(), notes: notes.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Save failed');
      return;
    }
    router.push(`/buildings/${buildingId}`);
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/sites" className="hover:text-gray-700">Sites</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        {siteId && (
          <>
            <Link href={`/sites/${siteId}`} className="hover:text-gray-700">{siteName}</Link>
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </>
        )}
        <Link href={`/buildings/${buildingId}`} className="hover:text-gray-700">{buildingName || 'Building'}</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Edit Building</h1>

      <form onSubmit={handleSave} className="card p-6 max-w-lg space-y-4">
        <div>
          <label className="form-label">Building Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={buildingName}
            onChange={e => setBuildingName(e.target.value)}
            className="form-input mt-1"
            placeholder="e.g. Main Office"
            autoFocus
          />
        </div>

        <div>
          <label className="form-label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            className="form-input mt-1 resize-none"
            placeholder="Any notes about this building…"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href={`/buildings/${buildingId}`} className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
