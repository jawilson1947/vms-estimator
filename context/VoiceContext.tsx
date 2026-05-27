'use client';

import {
  createContext, useContext, useState, useCallback,
  useRef, ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeak } from '@/hooks/useSpeak';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoiceMode = 'idle' | 'waitingForValue' | 'off';

export interface VoiceSite {
  id: number;
  siteName: string;
  buildings: { id: number; buildingName: string }[];
}

export interface VoiceCommand {
  keywords: string[];
  action: (remainder: string) => void;
}

interface VoiceContextValue {
  supported: boolean;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  mode: VoiceMode;
  activeField: string | null;
  lastHeard: string;
  listening: boolean;
  registerCommands: (id: string, commands: VoiceCommand[]) => () => void;
  setSites: (sites: VoiceSite[]) => void;
  /** Speak a confirmation aloud. Pauses recognition while speaking. */
  speak: (text: string) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used inside VoiceProvider');
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

interface MatchCandidate { site: VoiceSite; label: string; }

function buildCandidates(sites: VoiceSite[]): MatchCandidate[] {
  const out: MatchCandidate[] = [];
  for (const site of sites) {
    out.push({ site, label: normalize(site.siteName) });
    for (const b of site.buildings) {
      out.push({ site, label: normalize(b.buildingName) });
    }
  }
  return out;
}

function matchSite(spoken: string, sites: VoiceSite[]): VoiceSite | null {
  const norm = normalize(spoken);
  if (!norm || sites.length === 0) return null;

  const candidates = buildCandidates(sites);

  // 1. Exact match on site name or building name
  const exact = candidates.find(c => c.label === norm);
  if (exact) return exact.site;

  // 2. Substring match
  const sub = candidates.find(c => c.label.includes(norm) || norm.includes(c.label));
  if (sub) return sub.site;

  // 3. Levenshtein closest within 40% threshold
  let bestSite: VoiceSite | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(norm, c.label);
    if (d < bestDist) { bestDist = d; bestSite = c.site; }
  }
  const threshold = Math.ceil(norm.length * 0.4);
  return bestDist <= threshold ? bestSite : null;
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
  const [mode, setMode]               = useState<VoiceMode>('idle');
  const [activeField, setActiveField] = useState<string | null>(null);
  const [lastHeard, setLastHeard]     = useState('');
  const [sites, setSites]             = useState<VoiceSite[]>([]);

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

  const waitForValue = useCallback((fieldName: string, onValue: (v: string) => void) => {
    if (valueTimerRef.current) clearTimeout(valueTimerRef.current);
    setMode('waitingForValue');
    setActiveField(fieldName);
    valueCallbackRef.current = onValue;
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
          return;
        }
      }
    }
  // stable: uses refs for mode/sites, router is stable from Next.js
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const { supported, listening, pause, resume } = useSpeechRecognition(handleTranscript, enabled);
  const speak = useSpeak(pause, resume);
  speakRef.current = speak;

  const waitForValueRef = useRef(waitForValue);
  waitForValueRef.current = waitForValue;

  const contextValue: VoiceContextValue = {
    supported,
    enabled,
    setEnabled,
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
  return ctx._waitForValue.current as (fieldName: string, onValue: (v: string) => void) => void;
}
