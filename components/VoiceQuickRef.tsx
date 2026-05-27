'use client';

import { useState } from 'react';
import { XMarkIcon, QuestionMarkCircleIcon, MicrophoneIcon } from '@heroicons/react/24/outline';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommandRow {
  say: string;
  responds: string;
  note?: string;
}

interface CommandSection {
  title: string;
  subtitle?: string;
  commands: CommandRow[];
}

// ── Command data ──────────────────────────────────────────────────────────────

const SECTIONS: CommandSection[] = [
  {
    title: 'Open a Survey',
    subtitle: 'Say from anywhere in the app',
    commands: [
      { say: '"Start survey for [site name]"', responds: '"Opening survey for [site name]"' },
      { say: '"Start survey" or "Open survey"', responds: '"Opening survey"' },
    ],
  },
  {
    title: 'Survey Board',
    subtitle: 'Once inside a site',
    commands: [
      { say: '"Add location" or "New location"', responds: '"Opening add location"' },
    ],
  },
  {
    title: 'Add Location — Fields',
    subtitle: 'While the Add Location sheet is open',
    commands: [
      { say: '"Name"  →  speak value', responds: '"Say the area name" → "Name set to [value]"' },
      { say: '"Floor"  →  speak value', responds: '"Say the floor" → "Floor [value]"' },
      { say: '"Notes"  →  speak value', responds: '"Say your notes" → "Notes recorded"' },
      { say: '"Photo"', responds: '"Tap the screen to capture a photo"', note: '★ One tap required' },
      { say: '"Save"', responds: '"[Name] saved"', note: 'Closes sheet' },
      { say: '"Next"', responds: '"[Name] saved. Ready for next location."', note: 'Saves & clears for another' },
      { say: '"Exit" / "Cancel" / "Close"', responds: '"Closing"' },
    ],
  },
  {
    title: 'Location Detail',
    subtitle: 'While a location panel is open',
    commands: [
      { say: '"Save" or "Mark surveyed"', responds: '"[Name] marked as surveyed"' },
      { say: '"Photo"', responds: '"Tap the screen to add a photo" → "Photo added. N of 5."', note: '★ One tap required' },
      { say: '"Close" / "Back" / "Exit"', responds: '"Closing"' },
    ],
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionBlock({ section }: { section: CommandSection }) {
  return (
    <div className="mb-5">
      {/* Section header */}
      <div className="mb-2">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">{section.title}</p>
        {section.subtitle && (
          <p className="text-xs text-gray-400 italic">{section.subtitle}</p>
        )}
      </div>

      {/* Command rows */}
      <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr] bg-blue-600 text-white text-xs font-semibold px-3 py-2 gap-3">
          <span>You say</span>
          <span>Device responds</span>
        </div>

        {section.commands.map((cmd, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_1fr] px-3 py-2.5 gap-3 text-xs border-t border-gray-100 ${
              i % 2 === 0 ? 'bg-gray-50' : 'bg-white'
            }`}
          >
            {/* You say */}
            <div>
              <span className="font-mono text-blue-700 leading-snug">{cmd.say}</span>
              {cmd.note && (
                <span className="ml-1.5 text-amber-600 font-semibold">{cmd.note}</span>
              )}
            </div>
            {/* Device responds */}
            <div className="text-green-700 italic leading-snug">{cmd.responds}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function VoiceQuickRef() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        title="Voice command quick reference"
        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-lg text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
        aria-label="Voice command help"
      >
        <QuestionMarkCircleIcon className="w-5 h-5" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100">
                  <MicrophoneIcon className="w-4 h-4 text-blue-600" />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Voice Command Reference</p>
                  <p className="text-xs text-gray-400">Speak any command — device confirms aloud</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors ml-4 shrink-0"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-5 py-4 flex-1">
              {/* Tip banner */}
              <div className="flex items-start gap-2 p-3 mb-5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <span className="text-base shrink-0">★</span>
                <span>
                  <strong>Photo capture</strong> is the only step that requires a screen tap.
                  All other commands are fully hands-free.
                </span>
              </div>

              {SECTIONS.map((section, i) => (
                <SectionBlock key={i} section={section} />
              ))}

              {/* Timeout note */}
              <div className="mt-1 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500">
                <strong className="text-gray-700">Timeout:</strong> After a field prompt, you have{' '}
                <strong>6 seconds</strong> to speak the value. If the window closes, the device says{' '}
                <span className="text-green-700 italic">&ldquo;Timed out. Try again.&rdquo;</span> — just
                repeat the field command to retry.
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
