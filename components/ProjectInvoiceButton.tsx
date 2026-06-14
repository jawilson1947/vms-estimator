'use client';

import { useState } from 'react';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { InvoiceModal } from '@/components/InvoiceModal';

interface Props {
  projectId:   number;
  projectName: string;
}

export function ProjectInvoiceButton({ projectId, projectName }: Props) {
  const [showModal, setShowModal] = useState(false);

  function handleSaved() {
    window.dispatchEvent(new CustomEvent('invoice-saved'));
  }

  return (
    <>
      <button onClick={() => setShowModal(true)} className="btn-secondary gap-1.5">
        <BanknotesIcon className="w-4 h-4" />
        Prepare Invoice
      </button>

      {showModal && (
        <InvoiceModal
          projectId={projectId}
          projectName={projectName}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
