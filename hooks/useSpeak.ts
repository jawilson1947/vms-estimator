'use client';

import { useCallback, useRef } from 'react';

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * Returns `{ speak, isTTSSupported }` backed by the browser's SpeechSynthesis API.
 *
 * iOS-specific fixes applied here:
 *  1. cancel() only when already speaking — cancel() on an idle iOS synthesiser
 *     prevents the next speak() from firing.
 *  2. iOS speechSynthesis freezes after ~15 s; the periodic resume() pump prevents
 *     utterances from hanging silently.
 *  3. An immediate resume() after speak() kicks iOS off the starting block.
 */
export function useSpeak(
  pauseRecognition?: () => void,
  resumeRecognition?: () => void,
): { speak: (text: string, opts?: SpeakOptions) => void; isTTSSupported: boolean } {
  const pauseRef  = useRef(pauseRecognition);
  const resumeRef = useRef(resumeRecognition);
  pauseRef.current  = pauseRecognition;
  resumeRef.current = resumeRecognition;

  const pumpRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const speak = useCallback((text: string, opts?: SpeakOptions) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utt    = new SpeechSynthesisUtterance(text);
    utt.lang     = 'en-US';
    utt.rate     = opts?.rate   ?? 1.1;
    utt.pitch    = opts?.pitch  ?? 1;
    utt.volume   = opts?.volume ?? 1;

    utt.onstart = () => {
      pauseRef.current?.();

      if (pumpRef.current) clearInterval(pumpRef.current);
      pumpRef.current = setInterval(() => {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      }, 5000);
    };

    const finish = () => {
      if (pumpRef.current) { clearInterval(pumpRef.current); pumpRef.current = null; }
      resumeRef.current?.();
    };
    utt.onend   = finish;
    utt.onerror = finish;

    window.speechSynthesis.speak(utt);
    window.speechSynthesis.resume();
  }, []);

  const isTTSSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  return { speak, isTTSSupported };
}
