'use client';

import { useState } from 'react';
import { DocumentPlusIcon } from '@heroicons/react/24/outline';
import { ProposalModal } from '@/components/ProposalModal';

interface Props {
  projectId:   number;
  projectName: string;
}

export function ProjectProposalButton({ projectId, projectName }: Props) {
  const [showModal, setShowModal] = useState(false);
  // refreshKey is stored in sessionStorage so ProposalHistoryPanel can read it
  function handleSaved() {
    // signal the history panel via a custom event
    window.dispatchEvent(new CustomEvent('proposal-saved'));
  }

  return (
    <>
      <button onClick={() => setShowModal(true)} className="btn-secondary gap-1.5">
        <DocumentPlusIcon className="w-4 h-4" />
        Prepare Proposal
      </button>

      {showModal && (
        <ProposalModal
          projectId={projectId}
          projectName={projectName}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
