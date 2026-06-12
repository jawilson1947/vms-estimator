'use client';

import {
  createContext, useContext, useState, useCallback,
  useEffect, useRef, ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeak } from '@/hooks/useSpeak';
import { matchOption } from '@/lib/voiceMatch';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoiceMode = 'idle' | 'waitingForValue' | 'off';

export interface VoiceSite {
  id: number;
  siteName: string;
  buildings: { id: number; buildingName: string }[];
}

export interface VoiceCommand {
  keywords: string[];
  /** Spoken aloud automatically after the action fires (if TTS is not muted). */
  ack?: string;
  action: (remainder: string) => void;
}

interface VoiceContextValue {
  supported: boolean;
  isTTSSupported: boolean;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  muted: boolean;
  setMuted: (v: boolean) => void;
  mode: VoiceMode;
  activeField: string | null;
  lastHeard: string;
  listening: boolean;
  registerCommands: (id: string, commands: VoiceCommand[]) => () => void;
  setSites: (sites: VoiceSite[]) => void;
  /** Speak a confirmation aloud. Pauses recognition while speaking. No-op when muted. */
  speak: (text: string) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used inside VoiceProvider');
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchSite(spoken: string, sites: VoiceSite[]): VoiceSite | null {
  return matchOption(spoken, sites, s => [s.siteName, ...s.buildings.map(b => b.buildingName)]);
}

// ── Provider ──────────────────────────────────────────────────────────────────

const VALUE_TIMEOUT_MS = 6000;

// Ref to the speak function — kept as a ref so handleTranscript (stable callback) can call it
// without recreating itself whenever speak changes identity.
// Populated inside VoiceProvider after speak is initialised.

// Regex to parse "start/open/launch survey [for] <name>" or "survey [for] <name>"
const SURVEY_CMD_RE = /^(?:(?:start|open|launch)\s+survey|survey)\s+(?:for\s+)?(.+)$/;

export function VoiceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [enabled, setEnabled]         = useState(true);
  const [muted, setMutedState]        = useState(false);
  const [mode, setMode]               = useState<VoiceMode>('idle');
  const [activeField, setActiveField] = useState<string | null>(null);
  const [lastHeard, setLastHeard]     = useState('');
  const [sites, setSites]             = useState<VoiceSite[]>([]);

  // Init muted from localStorage after mount; avoid SSR mismatch by starting false.
  useEffect(() => {
    try { setMutedState(localStorage.getItem('voiceMuted') === 'true'); } catch {}
  }, []);
  // Persist muted state.
  useEffect(() => {
    try { localStorage.setItem('voiceMuted', String(muted)); } catch {}
  }, [muted]);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const setMuted = useCallback((v: boolean) => setMutedState(v), []);

  const commandsRef      = useRef<Map<string, VoiceCommand[]>>(new Map());
  const valueCallbackRef = useRef<((value: string) => void) | null>(null);
  const valueTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef          = useRef(mode);
  const sitesRef         = useRef(sites);
  const speakRef         = useRef<(text: string) => void>(() => {});
  modeRef.current  = mode;
  sitesRef.current = sites;

  function clearValueMode(timedOut = false) {
    if (valueTimerRef.current) clearTimeout(valueTimerRef.current);
    setMode('idle');
    setActiveField(null);
    valueCallbackRef.current = null;
    if (timedOut) speakRef.current('Timed out. Try again.');
  }

  const waitForValue = useCallback((
    fieldName: string,
    onValue: (v: string) => void,
    opts?: { promptText?: string; captureText?: string | ((v: string) => string) },
  ) => {
    if (valueTimerRef.current) clearTimeout(valueTimerRef.current);
    setMode('waitingForValue');
    setActiveField(fieldName);
    valueCallbackRef.current = (val: string) => {
      onValue(val);
      if (opts?.captureText) {
        const text = typeof opts.captureText === 'function'
          ? opts.captureText(val)
          : opts.captureText;
        speakRef.current(text);
      }
    };
    // Speak the prompt AFTER setting up capture mode; useSpeak handles mic pause/resume.
    if (opts?.promptText) speakRef.current(opts.promptText);
    valueTimerRef.current = setTimeout(() => clearValueMode(true), VALUE_TIMEOUT_MS);
  }, []);

  const registerCommands = useCallback((id: string, commands: VoiceCommand[]) => {
    commandsRef.current.set(id, commands);
    return () => { commandsRef.current.delete(id); };
  }, []);

  // Use refs for mode and sites so the callback is stable (never recreated)
  const handleTranscript = useCallback((text: string) => {
    setLastHeard(text);

    // If waiting for a field value, consume this utterance as the value
    if (modeRef.current === 'waitingForValue' && valueCallbackRef.current) {
      valueCallbackRef.current(text);
      clearValueMode();
      return;
    }

    // "start survey for <name>" — matches site names AND building names
    const surveyMatch = SURVEY_CMD_RE.exec(text);
    if (surveyMatch) {
      const spoken = surveyMatch[1].trim();
      const site = matchSite(spoken, sitesRef.current);
      if (site) {
        speakRef.current(`Opening survey for ${site.siteName}`);
        router.push('/survey/' + site.id);
      } else {
        speakRef.current('Site not found. Opening survey list.');
        router.push('/survey');
      }
      return;
    }

    // "start survey" / "survey" with no name
    if (text === 'start survey' || text === 'open survey' || text === 'survey') {
      speakRef.current('Opening survey');
      router.push('/survey');
      return;
    }

    // Context-registered commands
    const allCommands = Array.from(commandsRef.current.values()).flat();
    for (const cmd of allCommands) {
      for (const kw of cmd.keywords) {
        if (text === kw || text.startsWith(kw + ' ')) {
          cmd.action(text.slice(kw.length).trim());
          if (cmd.ack) speakRef.current(cmd.ack);
          return;
        }
      }
    }
  // stable: uses refs for mode/sites, router is stable from Next.js
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const { supported, listening, pause, resume } = useSpeechRecognition(handleTranscript, enabled);
  const { speak: rawSpeak, isTTSSupported } = useSpeak(pause, resume);

  // Wrap rawSpeak so it becomes a no-op while muted.
  const speak = useCallback((text: string) => {
    if (mutedRef.current) return;
    rawSpeak(text);
  }, [rawSpeak]);
  speakRef.current = speak;

  const waitForValueRef = useRef(waitForValue);
  waitForValueRef.current = waitForValue;

  const contextValue: VoiceContextValue = {
    supported,
    isTTSSupported,
    enabled,
    setEnabled,
    muted,
    setMuted,
    mode,
    activeField,
    lastHeard,
    listening,
    registerCommands,
    setSites,
    speak,
  };

  // Side-channel so useWaitForValue() can access waitForValue without context churn
  (contextValue as any)._waitForValue = waitForValueRef;

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
    </VoiceContext.Provider>
  );
}

/** Convenience hook to access waitForValue */
export function useWaitForValue() {
  const ctx = useContext(VoiceContext) as any;
  if (!ctx) throw new Error('useWaitForValue must be used inside VoiceProvider');
  return ctx._waitForValue.current as (
    fieldName: string,
    onValue: (v: string) => void,
    opts?: { promptText?: string; captureText?: string | ((v: string) => string) },
  ) => void;
}
