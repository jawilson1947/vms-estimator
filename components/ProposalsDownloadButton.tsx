'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Props {
  projectId:   number;
  proposalId:  number;
  projectName: string;
}

export function ProposalsDownloadButton({ projectId, proposalId, projectName }: Props) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/proposals/${proposalId}/pdf`, { method: 'POST' });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `proposal-${projectName.toLowerCase().replace(/\s+/g, '-')}-v${proposalId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/projects/${projectId}/proposals/${proposalId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-40"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="text-xs text-gray-500 hover:text-gray-700 px-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={download}
        disabled={downloading}
        title="Download PDF"
        className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <ArrowDownTrayIcon className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        title="Delete proposal"
        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
