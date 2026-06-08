'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  projectId:    number;
  buildingId:   number;
  buildingName: string;
}

export function RemoveBuildingButton({ projectId, buildingId, buildingName }: Props) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!confirm(`Remove "${buildingName}" from this project?`)) return;
    setRemoving(true);
    try {
      await fetch(`/api/projects/${projectId}/buildings/${buildingId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={removing}
      title="Remove from project"
      className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      <XMarkIcon className="w-3.5 h-3.5" />
    </button>
  );
}
