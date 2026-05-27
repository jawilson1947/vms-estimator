'use client';

import { useVoice } from '@/context/VoiceContext';
import { MicrophoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

export function VoiceMic() {
  const { supported, enabled, setEnabled, mode, activeField, lastHeard, listening } = useVoice();
  const [flash, setFlash] = useState(false);

  // Flash green briefly when a command is recognized
  useEffect(() => {
    if (!lastHeard) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [lastHeard]);

  if (!supported) {
    return (
      <div className="flex items-center gap-1.5 text-gray-400 text-xs" title="Voice not supported in this browser">
        <MicrophoneIcon className="w-3.5 h-3.5 line-through opacity-40" />
        <span className="hidden sm:inline opacity-40">Voice unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Status label */}
      {enabled && (
        <div className="hidden sm:flex items-center gap-1.5 max-w-[180px]">
          {mode === 'waitingForValue' ? (
            <span className="text-xs text-amber-600 font-medium truncate animate-pulse">
              Listening for: {activeField}…
            </span>
          ) : flash ? (
            <span className="text-xs text-green-600 font-medium truncate">
              ✓ {lastHeard}
            </span>
          ) : (
            <span className="text-xs text-gray-400 truncate">
              {lastHeard ? `"${lastHeard}"` : 'Say a command…'}
            </span>
          )}
        </div>
      )}

      {/* Mic button */}
      <button
        onClick={() => setEnabled(!enabled)}
        title={enabled ? 'Disable voice commands' : 'Enable voice commands'}
        className="relative flex items-center justify-center w-7 h-7 rounded-full transition-colors"
      >
        {/* Pulse ring when actively listening */}
        {enabled && listening && mode === 'idle' && (
          <span className="absolute inset-0 rounded-full bg-red-400 opacity-30 animate-ping" />
        )}
        {/* Amber ring when waiting for value */}
        {enabled && mode === 'waitingForValue' && (
          <span className="absolute inset-0 rounded-full bg-amber-400 opacity-40 animate-ping" />
        )}

        <MicrophoneIcon
          className={
            !enabled
              ? 'w-4 h-4 text-gray-400'
              : mode === 'waitingForValue'
              ? 'w-4 h-4 text-amber-500'
              : flash
              ? 'w-4 h-4 text-green-500'
              : listening
              ? 'w-4 h-4 text-red-500'
              : 'w-4 h-4 text-gray-500'
          }
        />

        {/* Disabled slash */}
        {!enabled && (
          <XMarkIcon className="absolute w-3 h-3 text-gray-400 bottom-0 right-0" />
        )}
      </button>
    </div>
  );
}
