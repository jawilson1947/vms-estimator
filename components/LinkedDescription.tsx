'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  description: string | null;
  url?:        string | null;
}

export function LinkedDescription({ description, url }: Props) {
  const [open, setOpen] = useState(false);
  const text = description || '—';

  if (!url) return <span>{text}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-blue-600 hover:underline hover:text-blue-800 text-left"
        title={url}
      >
        {text}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
            style={{ width: '80vw', height: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
              <span className="text-xs text-gray-500 truncate max-w-xl" title={url}>{url}</span>
              <button
                onClick={() => setOpen(false)}
                className="ml-3 p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 shrink-0"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <iframe
              src={url}
              className="flex-1 w-full border-0"
              title={text}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>
      )}
    </>
  );
}
