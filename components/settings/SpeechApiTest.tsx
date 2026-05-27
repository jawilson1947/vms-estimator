'use client';

import { useState, useRef, useEffect } from 'react';
import { useVoice } from '@/context/VoiceContext';
import {
  MicrophoneIcon,
  StopIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ShieldExclamationIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

type Phase = 'idle' | 'listening' | 'error';
type PermState = 'granted' | 'denied' | 'prompt' | 'unknown';

interface LogEntry {
  type: 'transcript' | 'error' | 'status' | 'raw';
  text: string;
  ts: string;
}

export function SpeechApiTest() {
  const { supported, enabled, setEnabled, lastHeard } = useVoice();
  const [phase,      setPhase]    = useState<Phase>('idle');
  const [log,        setLog]      = useState<LogEntry[]>([]);
  const [rawLog,     setRawLog]   = useState<LogEntry[]>([]);
  const [micPerm,    setMicPerm]  = useState<PermState>('unknown');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef      = useRef<any>(null);
  const wasEnabledRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then(result => {
        setMicPerm(result.state as PermState);
        result.onchange = () => setMicPerm(result.state as PermState);
      })
      .catch(() => setMicPerm('unknown'));
  }, []);

  function addLog(type: LogEntry['type'], text: string) {
    const ts = new Date().toLocaleTimeString();
    setLog(prev => [...prev.slice(-19), { type, text, ts }]);
  }

  // ── Minimal raw test — zero React state in the hot path ──────────────────
  // Runs entirely in the click handler. No setEnabled, no delays.
  // If THIS aborts, the issue is 100% Chrome / OS level.
  function runRawTest() {
    setRawLog([]);
    const addRaw = (type: LogEntry['type'], text: string) => {
      const ts = new Date().toLocaleTimeString();
      setRawLog(prev => [...prev.slice(-9), { type, text, ts }]);
    };

    const win = window as any;
    const SR  = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) { addRaw('error', 'SpeechRecognition not available'); return; }

    addRaw('status', 'Creating instance…');
    const r = new SR();
    r.continuous     = false; // single utterance — simplest possible mode
    r.interimResults = false;
    r.lang           = 'en-US';

    r.onstart  = () => addRaw('status', '✓ onstart fired — Chrome is listening');
    r.onend    = () => addRaw('status', 'onend fired — stopped');
    r.onerror  = (e: any) => addRaw('error', `onerror: ${e.error}${e.message ? ' / ' + e.message : ''}`);
    r.onspeechstart = () => addRaw('status', 'Speech detected');
    r.onresult = (e: any) => {
      addRaw('transcript', `"${e.results[0][0].transcript}" (${Math.round(e.results[0][0].confidence * 100)}%)`);
    };
    r.onnomatch = () => addRaw('status', 'No match');

    try {
      r.start();
      addRaw('status', 'start() called — waiting for Chrome…');
    } catch (err) {
      addRaw('error', `start() threw: ${err}`);
    }
  }

  // ── Full diagnostic test ──────────────────────────────────────────────────
  function start() {
    if (typeof window === 'undefined') return;
    const win = window as any;
    const SR  = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) return;

    wasEnabledRef.current = enabled;
    if (enabled) setEnabled(false);

    setTimeout(() => {
      const r = new SR();
      r.continuous      = true;
      r.interimResults  = true;
      r.lang            = 'en-US';
      r.maxAlternatives = 1;
      recogRef.current  = r;

      r.onstart  = () => { setPhase('listening'); addLog('status', 'Listening started'); };
      r.onend    = () => {
        setPhase('idle');
        addLog('status', 'Listening ended');
        if (wasEnabledRef.current) setEnabled(true);
      };
      r.onerror  = (e: any) => {
        setPhase('error');
        addLog('error', `Error: ${e.error}${e.message ? ' — ' + e.message : ''}`);
      };
      r.onresult = (e: any) => {
        const result = e.results[e.results.length - 1];
        const text   = result[0].transcript;
        const final  = result.isFinal;
        addLog('transcript', `${final ? '✓' : '~'} "${text}"`);
      };

      try {
        r.start();
      } catch (err) {
        addLog('error', `Could not start: ${err}`);
        setPhase('error');
        if (wasEnabledRef.current) setEnabled(true);
      }
    }, 800);
  }

  function stop() {
    try { recogRef.current?.stop(); } catch { /* ignore */ }
    setPhase('idle');
    if (wasEnabledRef.current) setEnabled(true);
  }

  useEffect(() => () => {
    try { recogRef.current?.stop(); } catch { /* ignore */ }
    if (wasEnabledRef.current) setEnabled(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const permColor: Record<PermState, string> = {
    granted: 'text-green-700 bg-green-50 border-green-200',
    denied:  'text-red-700 bg-red-50 border-red-200',
    prompt:  'text-amber-700 bg-amber-50 border-amber-200',
    unknown: 'text-gray-600 bg-gray-50 border-gray-200',
  };
  const permLabel: Record<PermState, string> = {
    granted: '✓ Microphone: Granted',
    denied:  '✗ Microphone: Denied — click the lock icon in the address bar to reset',
    prompt:  '⚠ Microphone: Not yet decided — Chrome will prompt on first use',
    unknown: '? Microphone permission status unknown',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <InformationCircleIcon className="w-4 h-4 text-violet-500" />
        <h2 className="text-sm font-semibold text-gray-800">Speech API Diagnostic</h2>
      </div>

      {/* Permission status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${permColor[micPerm]}`}>
        <ShieldExclamationIcon className="w-3.5 h-3.5 shrink-0" />
        {permLabel[micPerm]}
      </div>

      {!supported && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700"><strong>Web Speech API not supported.</strong> Requires Google Chrome.</p>
        </div>
      )}

      {supported && (
        <>
          {/* ── Minimal raw test ── */}
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-violet-800">Step 1 — Minimal Raw Test</p>
                <p className="text-xs text-violet-600 mt-0.5">
                  Zero React state. One utterance. If this aborts, the issue is Chrome or Windows — not the app.
                </p>
              </div>
              <button onClick={runRawTest} className="btn-secondary flex items-center gap-1.5 shrink-0 ml-3">
                <BoltIcon className="w-3.5 h-3.5 text-violet-500" />
                Run Raw Test
              </button>
            </div>
            {rawLog.length > 0 && (
              <div className="bg-gray-900 rounded p-2 space-y-1 font-mono">
                {rawLog.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-500 shrink-0">{e.ts}</span>
                    <span className={
                      e.type === 'transcript' ? 'text-green-400' :
                      e.type === 'error'      ? 'text-red-400'   : 'text-gray-400'
                    }>{e.text}</span>
                  </div>
                ))}
              </div>
            )}
            {rawLog.length === 0 && (
              <p className="text-xs text-violet-400 italic">Click Run Raw Test, then speak one sentence.</p>
            )}
          </div>

          {/* ── Full diagnostic ── */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700">Step 2 — Full Diagnostic (continuous mode)</p>

            {lastHeard && phase !== 'listening' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
                <CheckCircleIcon className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className="text-xs text-green-700">Voice system last heard: <strong>&quot;{lastHeard}&quot;</strong></span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {phase !== 'listening' ? (
                <button onClick={start} className="btn-primary flex items-center gap-1.5">
                  <MicrophoneIcon className="w-3.5 h-3.5" />
                  Start Listening
                </button>
              ) : (
                <button onClick={stop} className="btn-danger flex items-center gap-1.5">
                  <StopIcon className="w-3.5 h-3.5" />
                  Stop
                </button>
              )}
              {phase === 'listening' && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-gray-600 font-medium">Listening — speak now</span>
                </div>
              )}
            </div>

            {log.length > 0 ? (
              <div className="bg-gray-900 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto font-mono">
                {log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-500 shrink-0">{entry.ts}</span>
                    <span className={
                      entry.type === 'transcript' ? 'text-green-400' :
                      entry.type === 'error'      ? 'text-red-400'   : 'text-gray-400'
                    }>{entry.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Log appears here.</p>
            )}
          </div>

          {/* Checklist if still failing */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">If both tests show &quot;aborted&quot; — check these:</p>
            <div className="space-y-1 text-xs text-amber-700">
              <p>1. <strong>Windows Privacy:</strong> Settings → Privacy → Speech → turn on &quot;Online speech recognition&quot;</p>
              <p>2. <strong>Chrome policies:</strong> Open a new tab → type <strong>chrome://policy</strong> → look for any speech-related entries</p>
              <p>3. <strong>Chrome site permissions:</strong> Click the 🔒 lock icon in the address bar → check Microphone is &quot;Allow&quot;</p>
              <p>4. <strong>Try a fresh Chrome profile:</strong> Chrome menu → Profiles → Add → test in the new profile</p>
              <p>5. <strong>Antivirus / endpoint security:</strong> Some corporate AV tools (CrowdStrike, SentinelOne) block browser audio APIs system-wide</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
