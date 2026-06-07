'use client';

import { useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface Props {
  projectId:   number;
  proposalId:  number;
  projectName: string;
}

export function ProposalsDownloadButton({ projectId, proposalId, projectName }: Props) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      title="Download PDF"
      className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      <ArrowDownTrayIcon className={`w-4 h-4 ${loading ? 'animate-bounce' : ''}`} />
    </button>
  );
}
