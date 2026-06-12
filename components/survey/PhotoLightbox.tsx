'use client';

import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export function PhotoLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <XMarkIcon className="w-5 h-5 text-white" />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
        style={{ maxHeight: '90vh', maxWidth: '90vw' }}
      />
    </div>
  );
}
