# Voice Acknowledgement Plan
## Hands-Free Survey & Location Workflow

**Date:** 2026-05-27  
**Scope:** Add spoken (TTS) confirmation for every voice command so the surveyor never needs to look at the device unless capturing images.

---

## 1. Goal

Every voice command currently executes silently — the UI updates visually, but there is no audio feedback. This plan adds a spoken acknowledgement after each command so the user hears confirmation that the action was taken. The only time a glance at the device is required is when the system prompts to capture a photo (because the camera shutter still needs a tap).

---

## 2. Technology Recommendation: Web Speech API — `speechSynthesis`

The app already uses `window.SpeechRecognition` (Web Speech API) via `hooks/useSpeechRecognition.ts`. The same API includes `window.speechSynthesis` for text-to-speech — no new dependencies, no API keys, works entirely in the browser.

**Why not a third-party service (ElevenLabs, Polly, etc.)?**  
Latency. A round-trip to a cloud TTS service adds 300–800 ms per utterance. For rapid hands-free data entry, the built-in `speechSynthesis` responds in under 50 ms and requires no network.

**Critical behaviour — feedback loop prevention:**  
While the browser is speaking, the speech recogniser must be paused. If it stays active it will hear its own output and attempt to execute phantom commands. The `speak()` function must call `recognition.stop()` before speaking and restart it in the `onend` callback of the utterance.

---

## 3. New File: `hooks/useSpeak.ts`

Create a single shared hook that the entire app imports.

```ts
'use client';
import { useCallback, useRef } from 'react';

/**
 * Returns a stable `speak(text)` function that:
 *  1. Cancels any in-flight utterance
 *  2. Temporarily pauses the speech recogniser (via a callback)
 *  3. Speaks the text
 *  4. Resumes the recogniser when done
 */
export function useSpeak(pauseRecognition?: () => void, resumeRecognition?: () => void) {
  const pauseRef  = useRef(pauseRecognition);
  const resumeRef = useRef(resumeRecognition);
  pauseRef.current  = pauseRecognition;
  resumeRef.current = resumeRecognition;

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();           // stop anything already playing
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang   = 'en-US';
    utt.rate   = 1.1;                          // slightly faster than default — less awkward
    utt.volume = 1;
    utt.onstart = () => pauseRef.current?.();
    utt.onend   = () => resumeRef.current?.();
    utt.onerror = () => resumeRef.current?.(); // always resume even on error
    window.speechSynthesis.speak(utt);
  }, []);

  return speak;
}
```

---

## 4. Changes to `context/VoiceContext.tsx`

### 4a. Export `speak` through the context

Add `speak: (text: string) => void` to `VoiceContextValue`.

### 4b. Wire the pause/resume callbacks

The recognition instance lives in `useSpeechRecognition`. Add two new callbacks to that hook's return value — `pause()` and `resume()` — that call `recognition.stop()` and `recognition.start()` respectively without disturbing the auto-restart timer.

### 4c. Add acknowledgements to global navigation commands

| Spoken command | Current behaviour | Add spoken acknowledgement |
|---|---|---|
| `"start survey for Acme HQ"` | Navigates to `/survey/<id>` | `"Opening survey for Acme HQ"` |
| `"start survey for <unmatched>"` | Navigates to `/survey` | `"Site not found. Opening survey list."` |
| `"start survey"` / `"open survey"` | Navigates to `/survey` | `"Opening survey"` |

---

## 5. Changes to `hooks/useSpeechRecognition.ts`

Add `pause()` and `resume()` to the returned object:

```ts
const pause = useCallback(() => {
  if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
  try { recognitionRef.current?.stop(); } catch { /* ignore */ }
}, []);

const resume = useCallback(() => {
  if (!enabledRef.current) return;
  try { recognitionRef.current?.start(); } catch { /* already running */ }
}, []);
```

Return signature becomes:
```ts
return { supported, listening, transcript, error, start, stop, pause, resume };
```

---

## 6. Changes to `components/SurveyBoard.tsx`

### 6a. `QuickAddSheet` — Add Location modal

This is the heart of the hands-free workflow. Every command needs a spoken response **and** a response for when a value is captured.

| Command | Prompt said to user | Value-capture confirmation |
|---|---|---|
| `"name"` | `"Say the area name"` | `"Name set to [value]"` |
| `"floor"` | `"Say the floor"` | `"Floor [value]"` |
| `"notes"` / `"note"` | `"Say your notes"` | `"Notes recorded"` |
| `"photo"` (under limit) | `"Tap the screen to capture a photo"` | _(triggered by image input change)_ |
| `"photo"` (at limit) | `"Photo limit reached. Five photos maximum."` | — |
| `"save"` (name present) | `"Saving location"` → after API resolves: `"[areaName] saved"` | — |
| `"save"` (no name) | `"Please say a name first"` | — |
| `"next"` (name present) | `"Saving location"` → after API resolves: `"[areaName] saved. Ready for next location."` | — |
| `"next"` (no name) | `"Please say a name first"` | — |
| `"exit"` / `"cancel"` / `"close"` | `"Closing"` | — |

**Implementation note on async saves:** The `handleSave` function is async. Call `speak("Saving location")` immediately when the command fires, then call `speak("[name] saved")` (or `speak("[name] saved. Ready for next location.")`) inside the `try` block after `onSave()` resolves, before clearing state.

### 6b. `SurveyBoard` main component

| Command | Acknowledgement |
|---|---|
| `"add location"` / `"new location"` | `"Opening add location"` |

### 6c. `LocationPanel` — Location detail modal

The `LocationPanel` doesn't currently register voice commands, but its async operations need spoken feedback when triggered by voice from within the panel context. Add the following commands and acknowledgements:

| Command | Acknowledgement |
|---|---|
| `"save"` / `"mark surveyed"` | `"Saving"` → after resolve: `"[areaName] marked as surveyed"` |
| `"photo"` | `"Tap the screen to add a photo"` → after upload: `"Photo added. [n] of 5."` |
| `"close"` / `"back"` | `"Closing"` |

---

## 7. Hands-Free Survey Session — Full Voice Script

This is how a complete walkthrough sounds from the user's perspective (no screen needed):

```
User:    "Start survey for Riverside Campus"
Device:  "Opening survey for Riverside Campus"

User:    "Add location"
Device:  "Opening add location"

User:    "Name"
Device:  "Say the area name"
User:    "Front lobby"
Device:  "Name set to Front lobby"

User:    "Floor"
Device:  "Say the floor"
User:    "1"
Device:  "Floor 1"

User:    "Notes"
Device:  "Say your notes"
User:    "Wide angle required, high ceiling, natural light from east"
Device:  "Notes recorded"

User:    "Photo"
Device:  "Tap the screen to capture a photo"
[User taps shutter — camera fires]
Device:  (no additional speech — photo added silently)

User:    "Save"
Device:  "Saving location"
         "Front lobby saved"

User:    "Add location"   ← or use "Next" inside the modal to skip this step
Device:  "Opening add location"
         ...
```

---

## 8. Edge Cases & Guard Rails

**Utterance during TTS:** If the user speaks while the device is still talking, the recogniser is paused and will miss it. The `rate: 1.1` setting keeps utterances short to minimise this window. Confirmations are kept to one sentence maximum.

**`waitingForValue` timeout:** The `VoiceContext` times out after 6 seconds if no value is spoken. When the timer fires, speak: `"Timed out. Try again."` to alert the user without visual feedback.

**Name not provided on save:** Rather than failing silently, the device says `"Please say a name first"`, prompting the user to issue the `"name"` command.

**`speechSynthesis` Chrome background tab bug:** Chrome suspends `speechSynthesis` when the tab is backgrounded. Since this is a field tool used with the screen on, this is acceptable. If needed, the fix is a periodic `speechSynthesis.resume()` heartbeat — document as a known limitation.

**SSR:** `window.speechSynthesis` is not available server-side. All calls must be guarded with `typeof window !== 'undefined'` (already handled inside `useSpeak`).

---

## 9. Implementation Sequence

1. **`hooks/useSpeechRecognition.ts`** — Add `pause()` and `resume()` to the return value.
2. **`hooks/useSpeak.ts`** — Create the new file.
3. **`context/VoiceContext.tsx`** — Wire `pause`/`resume` into `useSpeak`; add `speak` to context value; add acknowledgements to navigation commands; speak on `waitingForValue` timeout.
4. **`components/SurveyBoard.tsx` — `QuickAddSheet`** — Call `speak()` in every command action and after async save resolves.
5. **`components/SurveyBoard.tsx` — `SurveyBoard`** — Call `speak()` on `"add location"`.
6. **`components/SurveyBoard.tsx` — `LocationPanel`** — Register voice commands with acknowledgements.
7. **Manual test:** Walk through the full hands-free script in Section 7 on a physical device (Chrome on Android or iOS Safari) to verify no feedback loop occurs and all confirmations are heard clearly.

---

## 10. Files Changed Summary

| File | Change |
|---|---|
| `hooks/useSpeechRecognition.ts` | Add `pause()`, `resume()` |
| `hooks/useSpeak.ts` | **New file** — shared TTS hook |
| `context/VoiceContext.tsx` | Add `speak` to context; wire pause/resume; add nav command acknowledgements; timeout speech |
| `components/SurveyBoard.tsx` | Add `speak()` calls to `QuickAddSheet`, `SurveyBoard`, `LocationPanel` |
