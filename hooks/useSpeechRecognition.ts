'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// Augment window type for cross-browser support
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

export interface UseSpeechRecognitionReturn {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  /** Temporarily silence the recogniser (e.g. while TTS is speaking). */
  pause: () => void;
  /** Resume listening after a pause. No-op if recognition is disabled. */
  resume: () => void;
}

export function useSpeechRecognition(
  onResult: (transcript: string) => void,
  enabled = true
): UseSpeechRecognitionReturn {
  // Keep a ref to the latest onResult so the recognition handler never goes stale
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Start as false on both server and client to avoid hydration mismatch.
  // The real value is determined after mount in a useEffect.
  const [supported, setSupported] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef   = useRef<any>(null);
  const restartTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef       = useRef(enabled);
  // True while TTS is speaking — prevents onend from auto-restarting the
  // recogniser and picking up the spoken prompt as a field value.
  const pausedRef        = useRef(false);
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error,      setError]      = useState<string | null>(null);

  enabledRef.current = enabled;

  const start = useCallback(() => {
    if (!supported) return;
    recognitionRef.current?.start();
  }, [supported]);

  const stop = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    recognitionRef.current?.stop();
  }, []);

  /**
   * Pause recognition without disabling it — used by TTS to prevent the
   * recogniser from hearing its own output. Clears the auto-restart timer so
   * the recogniser stays quiet until resume() is called.
   */
  const pause = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    pausedRef.current = true;   // block onend from auto-restarting
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  /**
   * Resume recognition after a TTS-triggered pause. No-op when disabled.
   * Small delay lets the speaker audio decay so the mic doesn't immediately
   * pick up residual TTS sound.
   */
  const resume = useCallback(() => {
    if (!enabledRef.current) return;
    pausedRef.current = false;
    setTimeout(() => {
      if (!pausedRef.current && enabledRef.current) {
        try { recognitionRef.current?.start(); } catch { /* already running */ }
      }
    }, 350);
  }, []);

  // Detect support on the client only (avoids SSR/client hydration mismatch)
  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    setSupported(isSupported);
  }, []);

  useEffect(() => {
    if (!supported || typeof window === 'undefined') return;

    // ── React Strict Mode double-invoke guard ─────────────────────────────────
    // Strict Mode (dev only) mounts → cleans up → remounts. Without this flag,
    // the first instance's onend fires AFTER cleanup and races the second instance,
    // causing Chrome to continuously abort both (the "aborted" loop).
    let unmounted = false;

    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous     = true;
    recognition.interimResults = false;
    recognition.lang           = 'en-US';
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setListening(false);
      // Only restart if this instance is still active AND we weren't paused
      // deliberately by TTS (pausedRef guards against that case).
      if (!unmounted && enabledRef.current && !pausedRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (!unmounted && !pausedRef.current) {
            try { recognition.start(); } catch { /* already started */ }
          }
        }, 300);
      }
    };

    recognition.onerror = (e: any) => {
      // 'no-speech' and 'aborted' are benign — don't surface to UI
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setError(e.error);
    };

    recognition.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      if (result.isFinal) {
        const text = result[0].transcript.trim().toLowerCase();
        setTranscript(text);
        onResultRef.current(text);
      }
    };

    if (enabledRef.current) {
      try { recognition.start(); } catch { /* already running */ }
    }

    return () => {
      unmounted = true;  // prevents this instance's onend from restarting after teardown
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recognition.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  // React to enabled changes after the recognition instance exists
  useEffect(() => {
    if (!recognitionRef.current) return;
    if (enabled) {
      try { recognitionRef.current.start(); } catch { /* already running */ }
    } else {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
  }, [enabled]);

  return { supported, listening, transcript, error, start, stop, pause, resume };
}
