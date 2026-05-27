'use client';

import { useCallback, useRef } from 'react';

/**
 * Returns a stable `speak(text)` function backed by the browser's built-in
 * Web Speech API (speechSynthesis).
 *
 * Usage:
 *   const speak = useSpeak(pause, resume);
 *   speak("Location saved");
 *
 * The optional `pauseRecognition` / `resumeRecognition` callbacks are called
 * around each utterance so the speech recogniser does not hear its own output
 * and fire phantom commands.
 */
export function useSpeak(
  pauseRecognition?: () => void,
  resumeRecognition?: () => void,
) {
  // Keep refs so the callback is always fresh without re-creating speak()
  const pauseRef  = useRef(pauseRecognition);
  const resumeRef = useRef(resumeRecognition);
  pauseRef.current  = pauseRecognition;
  resumeRef.current = resumeRecognition;

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel anything already in-flight
    window.speechSynthesis.cancel();

    const utt    = new SpeechSynthesisUtterance(text);
    utt.lang     = 'en-US';
    utt.rate     = 1.1;   // slightly faster — less lag between commands
    utt.pitch    = 1;
    utt.volume   = 1;

    utt.onstart = () => pauseRef.current?.();
    utt.onend   = () => resumeRef.current?.();
    utt.onerror = () => resumeRef.current?.(); // always resume, even on error

    window.speechSynthesis.speak(utt);
  }, []);

  return speak;
}
