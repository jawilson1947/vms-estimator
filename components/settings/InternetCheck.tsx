'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowPathIcon,
  WifiIcon,
  ServerIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

type CheckStatus = 'pending' | 'ok' | 'fail';

interface DiagResult {
  browser:  CheckStatus;
  server:   CheckStatus;
  serverMs: number | null;
  external: CheckStatus;
}

const INITIAL: DiagResult = {
  browser:  'pending',
  server:   'pending',
  serverMs: null,
  external: 'pending',
};

export function InternetCheck() {
  const [result,   setResult]   = useState<DiagResult>(INITIAL);
  const [checking, setChecking] = useState(false);
  const [lastRun,  setLastRun]  = useState<Date | null>(null);

  const runChecks = useCallback(async () => {
    setChecking(true);
    setResult(INITIAL);

    // 1 — Browser online flag
    const browser: CheckStatus = navigator.onLine ? 'ok' : 'fail';
    setResult(r => ({ ...r, browser }));

    // 2 — App server latency
    let server: CheckStatus = 'fail';
    let serverMs: number | null = null;
    try {
      const t0  = performance.now();
      const res = await fetch('/api/health', { cache: 'no-store' });
      const t1  = performance.now();
      if (res.ok) {
        server   = 'ok';
        serverMs = Math.round(t1 - t0);
      }
    } catch {
      server = 'fail';
    }
    setResult(r => ({ ...r, server, serverMs }));

    // 3 — External internet (Cloudflare trace, no-cors so we only check reachability)
    let external: CheckStatus = 'fail';
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 5000);
      await fetch('https://1.1.1.1/cdn-cgi/trace', { mode: 'no-cors', signal: ctrl.signal });
      clearTimeout(tid);
      external = 'ok';
    } catch {
      external = 'fail';
    }
    setResult(r => ({ ...r, external }));

    setLastRun(new Date());
    setChecking(false);
  }, []);

  // Run on mount
  useEffect(() => { runChecks(); }, [runChecks]);

  // Re-run when browser online/offline changes
  useEffect(() => {
    const handler = () => runChecks();
    window.addEventListener('online',  handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online',  handler);
      window.removeEventListener('offline', handler);
    };
  }, [runChecks]);

  function StatusIcon({ status }: { status: CheckStatus }) {
    if (status === 'pending') return <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />;
    if (status === 'ok')      return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
    return <XCircleIcon className="w-4 h-4 text-red-500" />;
  }

  function StatusBadge({ status, okLabel, failLabel }: { status: CheckStatus; okLabel: string; failLabel: string }) {
    if (status === 'pending') return <span className="text-xs text-gray-400">Checking…</span>;
    if (status === 'ok')      return <span className="text-xs font-medium text-green-700">{okLabel}</span>;
    return <span className="text-xs font-medium text-red-700">{failLabel}</span>;
  }

  const overallOk = result.browser === 'ok' && result.server === 'ok' && result.external === 'ok';
  const anyFail   = result.browser === 'fail' || result.server === 'fail' || result.external === 'fail';
  const allDone   = result.browser !== 'pending' && result.server !== 'pending' && result.external !== 'pending';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <WifiIcon className="w-4 h-4 text-cyan-500" />
        <h2 className="text-sm font-semibold text-gray-800">Internet &amp; Connectivity</h2>
      </div>
      <p className="text-xs text-gray-500">
        Checks your browser connection, app server reachability, and external internet access.
      </p>

      {/* Summary banner */}
      {allDone && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
          overallOk
            ? 'bg-green-50 border-green-200 text-green-700'
            : anyFail
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {overallOk
            ? '✓ All systems reachable'
            : anyFail
            ? '✗ One or more checks failed'
            : '⚠ Partial connectivity'}
        </div>
      )}

      {/* Diagnostic rows */}
      <div className="space-y-2">
        {/* Browser */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <StatusIcon status={result.browser} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <WifiIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-xs font-medium text-gray-700">Browser network</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">navigator.onLine status</p>
          </div>
          <StatusBadge status={result.browser} okLabel="Connected" failLabel="Offline" />
        </div>

        {/* Server */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <StatusIcon status={result.server} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <ServerIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-xs font-medium text-gray-700">App server</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Round-trip to /api/health</p>
          </div>
          <div className="text-right">
            <StatusBadge status={result.server} okLabel="Reachable" failLabel="Unreachable" />
            {result.server === 'ok' && result.serverMs !== null && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <ClockIcon className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{result.serverMs} ms</span>
              </div>
            )}
          </div>
        </div>

        {/* External */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <StatusIcon status={result.external} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <GlobeAltIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-xs font-medium text-gray-700">External internet</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Probe to 1.1.1.1 (Cloudflare)</p>
          </div>
          <StatusBadge status={result.external} okLabel="Reachable" failLabel="Unreachable" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        {lastRun ? (
          <span className="text-xs text-gray-400">
            Last checked: {lastRun.toLocaleTimeString()}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={runChecks}
          disabled={checking}
          className="btn-secondary flex items-center gap-1.5"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}
