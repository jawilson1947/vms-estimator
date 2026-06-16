'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DocumentIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

interface SiteDocument {
  id: number;
  originalFileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string;
}

interface Props {
  siteId: number;
}

const MAX_DOCS = 5;
const ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg';
const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'];

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function SiteDocuments({ siteId }: Props) {
  const [docs, setDocs] = useState<SiteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/documents`);
      if (res.ok) setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const atLimit = docs.length >= MAX_DOCS;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (atLimit) { setError(`Limit reached: at most ${MAX_DOCS} documents per site.`); return; }

    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    if (!ALLOWED_EXT.includes(ext)) {
      setError('Allowed types: PDF, Word, Excel, PNG, JPG.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/sites/${siteId}/documents`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Upload failed.');
        return;
      }
      const newDoc: SiteDocument = await res.json();
      setDocs(prev => [...prev, newDoc]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(docId: number) {
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/sites/${siteId}/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) setDocs(prev => prev.filter(d => d.id !== docId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <DocumentIcon className="w-4 h-4 text-gray-400" />
          Documents
        </h3>
        <span className="text-xs text-gray-400">{docs.length} / {MAX_DOCS}</span>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <>
          {docs.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {docs.map(doc => (
                <li key={doc.id} className="flex items-center gap-2 text-xs">
                  <DocumentIcon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-gray-700 truncate flex-1">
                    {doc.originalFileName ?? doc.fileUrl}
                    {doc.fileSizeBytes ? ` (${formatBytes(doc.fileSizeBytes)})` : ''}
                  </span>
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-500 hover:text-blue-700 shrink-0"
                      title="Open document"
                    >
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40"
                    title="Delete document"
                  >
                    {deletingId === doc.id
                      ? <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                      : <TrashIcon className="w-3.5 h-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {docs.length === 0 && (
            <p className="text-xs text-gray-400 mb-3">No documents uploaded yet.</p>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || atLimit}
            className="flex items-center gap-1 text-xs text-blue-600 font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors disabled:opacity-40"
            title={atLimit ? `Maximum ${MAX_DOCS} documents` : 'Upload a document'}
          >
            {uploading
              ? <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
              : <ArrowUpTrayIcon className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Upload document'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handleUpload}
          />

          <p className="text-[11px] text-gray-400 mt-2">
            PDF, Word, Excel, PNG, or JPG · up to {MAX_DOCS} files · 25 MB each
          </p>

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </>
      )}
    </div>
  );
}
