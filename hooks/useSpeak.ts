'use client';

import { useCallback, useRef } from 'react';

/**
 * Returns a stable `speak(text)` function backed by the browser's built-in
 * Web Speech API (speechSynthesis).
 *
 * iOS-specific fixes applied here:
 *  1. cancel() immediately before speak() kills synthesis on iOS — we only
 *     cancel if something is actively speaking.
 *  2. iOS speechSynthesis freezes after ~15 s of inactivity; the resume()
 *     nudge prevents the utterance from hanging forever.
 *  3. A periodic resume() pump keeps iOS from silently dropping utterances.
 */
export function useSpeak(
  pauseRecognition?: () => void,
  resumeRecognition?: () => void,
) {
  const pauseRef  = useRef(pauseRecognition);
  const resumeRef = useRef(resumeRecognition);
  pauseRef.current  = pauseRecognition;
  resumeRef.current = resumeRecognition;

  // Keeps a reference to the iOS resume-pump interval so we can clear it.
  const pumpRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Only cancel if something is already speaking — calling cancel() on an
    // idle iOS synthesiser prevents the next speak() from firing.
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utt    = new SpeechSynthesisUtterance(text);
    utt.lang     = 'en-US';
    utt.rate     = 1.1;
    utt.pitch    = 1;
    utt.volume   = 1;

    utt.onstart = () => {
      pauseRef.current?.();

      // iOS freeze-prevention: resume() every 5 s while speaking.
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

    // iOS sometimes needs an immediate resume() call after speak() to actually
    // start — harmless on other platforms.
    window.speechSynthesis.resume();
  }, []);

  return speak;
}
