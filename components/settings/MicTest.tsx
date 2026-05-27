'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MicrophoneIcon,
  PlayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  StopIcon,
} from '@heroicons/react/24/outline';

type Phase = 'idle' | 'requesting' | 'recording' | 'recorded' | 'playing';

const RECORD_SECONDS = 5;
const BAR_COUNT = 24;

export function MicTest() {
  const [phase, setPhase]         = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(RECORD_SECONDS);
  const [errorMsg, setErrorMsg]   = useState('');
  const [bars, setBars]           = useState<number[]>(Array(BAR_COUNT).fill(0));

  const streamRef       = useRef<MediaStream | null>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const recorderRef     = useRef<MediaRecorder | null>(null);
  const chunksRef       = useRef<BlobPart[]>([]);
  const blobRef         = useRef<Blob | null>(null);
  const audioElRef      = useRef<HTMLAudioElement | null>(null);
  const rafRef          = useRef<number>(0);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef        = useRef<Phase>('idle');

  phaseRef.current = phase;

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
    }
    setBars(Array(BAR_COUNT).fill(0));
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Animate level bars ─────────────────────────────────────────────────────
  function startLevelMeter(analyser: AnalyserNode) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    function frame() {
      analyser.getByteFrequencyData(data);
      // Sample BAR_COUNT evenly-spaced bins from the lower half of the spectrum
      const step = Math.floor(data.length / 2 / BAR_COUNT);
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const val = data[i * step] ?? 0;
        return Math.round((val / 255) * 100);
      });
      setBars(next);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  // ── Start test ─────────────────────────────────────────────────────────────
  async function startTest() {
    setErrorMsg('');
    setPhase('requesting');
    setCountdown(RECORD_SECONDS);
    chunksRef.current = [];
    blobRef.current   = null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setErrorMsg('Microphone access was denied. Please allow microphone access in your browser settings and try again.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setErrorMsg('No microphone found. Please connect a microphone and try again.');
      } else {
        setErrorMsg(`Could not access microphone: ${msg}`);
      }
      setPhase('idle');
      return;
    }

    streamRef.current = stream;

    // Audio context + analyser
    const ctx      = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const source   = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    audioCtxRef.current  = ctx;
    analyserRef.current  = analyser;

    // MediaRecorder
    const recorder = new MediaRecorder(stream);
    recorderRef.current  = recorder;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      blobRef.current = new Blob(chunksRef.current, { type: 'audio/webm' });
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') { audioCtxRef.current.close(); audioCtxRef.current = null; }
      setBars(Array(BAR_COUNT).fill(0));
      setPhase('recorded');
    };

    recorder.start();
    setPhase('recording');
    startLevelMeter(analyser);

    // Countdown
    let remaining = RECORD_SECONDS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (recorderRef.current && recorderRef.current.state === 'recording') {
          recorderRef.current.stop();
        }
      }
    }, 1000);
  }

  // ── Stop early ─────────────────────────────────────────────────────────────
  function stopEarly() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  function playRecording() {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const audio = new Audio(url);
    audioElRef.current = audio;
    setPhase('playing');
    audio.onended = () => { URL.revokeObjectURL(url); setPhase('recorded'); };
    audio.onerror = () => { URL.revokeObjectURL(url); setPhase('recorded'); };
    audio.play();
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function reset() {
    cleanup();
    setPhase('idle');
    setCountdown(RECORD_SECONDS);
    setErrorMsg('');
    setBars(Array(BAR_COUNT).fill(0));
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function LevelMeter() {
    return (
      <div className="flex items-end justify-center gap-0.5 h-12 px-2 bg-gray-900 rounded-lg overflow-hidden">
        {bars.map((h, i) => {
          const pct = Math.max(2, h);
          const color = h > 80 ? 'bg-red-400' : h > 50 ? 'bg-amber-400' : 'bg-emerald-400';
          return (
            <div
              key={i}
              className={`w-2 rounded-t transition-all duration-75 ${color}`}
              style={{ height: `${pct}%` }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <MicrophoneIcon className="w-4 h-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800">Microphone Test</h2>
      </div>
      <p className="text-xs text-gray-500">
        Click <strong>Start Test</strong> to record {RECORD_SECONDS} seconds of audio, then play it back to confirm your microphone is working.
      </p>

      {/* Error */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Level meter — shown while recording */}
      {phase === 'recording' && (
        <div className="space-y-2">
          <LevelMeter />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Recording… <span className="font-semibold text-gray-700">{countdown}s</span> remaining
            </span>
            <button
              onClick={stopEarly}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <StopIcon className="w-3.5 h-3.5" />
              Stop early
            </button>
          </div>
        </div>
      )}

      {/* Requesting */}
      {phase === 'requesting' && (
        <div className="flex items-center gap-2 py-3">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-gray-500">Requesting microphone access…</span>
        </div>
      )}

      {/* Recorded — ready to play */}
      {phase === 'recorded' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-700 font-medium">Recording captured — play it back to check your mic.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={playRecording} className="btn-primary flex items-center gap-1.5">
              <PlayIcon className="w-3.5 h-3.5" />
              Play back recording
            </button>
            <button onClick={reset} className="btn-secondary flex items-center gap-1.5">
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Test again
            </button>
          </div>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-gray-600 font-medium">Playing back your recording…</span>
        </div>
      )}

      {/* Idle — start button */}
      {(phase === 'idle') && (
        <button onClick={startTest} className="btn-primary flex items-center gap-1.5">
          <MicrophoneIcon className="w-3.5 h-3.5" />
          Start Test
        </button>
      )}
    </div>
  );
}
