'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DocumentIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

interface FloorPlan {
  id: number;
  floor: string;
  originalFileName: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string;
}

interface Props {
  buildingId: number;
}

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function BuildingFloorPlans({ buildingId }: Props) {
  const [plans,     setPlans]     = useState<FloorPlan[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error,     setError]     = useState('');
  const [floor,     setFloor]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`/api/buildings/${buildingId}/floor-plans`);
      if (res.ok) setPlans(await res.json());
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!floor.trim()) { setError('Enter a floor label before uploading.'); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      fd.append('floor', floor.trim());
      const res = await fetch(`/api/buildings/${buildingId}/floor-plans`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Upload failed.');
        return;
      }
      const newPlan: FloorPlan = await res.json();
      setPlans(prev => {
        const filtered = prev.filter(p => p.floor !== newPlan.floor);
        return [...filtered, newPlan].sort((a, b) => a.floor.localeCompare(b.floor));
      });
      setFloor('');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(planId: number) {
    setDeletingId(planId);
    try {
      const res = await fetch(
        `/api/buildings/${buildingId}/floor-plans/${planId}`,
        { method: 'DELETE' }
      );
      if (res.ok) setPlans(prev => prev.filter(p => p.id !== planId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <DocumentIcon className="w-3.5 h-3.5" />
        Floor Plans
      </p>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <>
          {/* Existing plans */}
          {plans.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {plans.map(plan => (
                <li key={plan.id} className="flex items-center gap-2 text-xs">
                  <DocumentIcon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="font-medium text-gray-700 w-20 shrink-0">
                    Floor {plan.floor}
                  </span>
                  <span className="text-gray-400 truncate flex-1">
                    {plan.originalFileName ?? plan.fileUrl}
                    {plan.fileSizeBytes ? ` (${formatBytes(plan.fileSizeBytes)})` : ''}
                  </span>
                  {plan.fileUrl && (
                    <a
                      href={plan.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-500 hover:text-blue-700 shrink-0"
                      title="Open PDF"
                    >
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(plan.id)}
                    disabled={deletingId === plan.id}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40"
                    title="Delete floor plan"
                  >
                    {deletingId === plan.id
                      ? <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                      : <TrashIcon className="w-3.5 h-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Upload row */}
          <div className="flex items-center gap-2">
            <input
              value={floor}
              onChange={e => setFloor(e.target.value)}
              placeholder="Floor (e.g. 1, 2, B)"
              className="input-field text-xs w-28 py-1"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !floor.trim()}
              className="flex items-center gap-1 text-xs text-blue-600 font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors disabled:opacity-40"
            >
              {uploading
                ? <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                : <ArrowUpTrayIcon className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading…' : 'Upload PDF'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </>
      )}
    </div>
  );
}
