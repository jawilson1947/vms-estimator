// Fuzzy matching for spoken values: exact → substring → Levenshtein ≤40%.

export function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

export function levenshtein(a: string, b: string): number {
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

/**
 * Match a spoken phrase against options, each of which may expose several
 * spoken labels (e.g. a site name plus its building names).
 */
export function matchOption<T>(
  spoken: string,
  options: T[],
  getLabels: (option: T) => (string | null | undefined)[],
): T | null {
  const norm = normalize(spoken);
  if (!norm || options.length === 0) return null;

  const candidates: { option: T; label: string }[] = [];
  for (const option of options) {
    for (const raw of getLabels(option)) {
      if (raw) candidates.push({ option, label: normalize(raw) });
    }
  }

  const exact = candidates.find(c => c.label === norm);
  if (exact) return exact.option;

  const sub = candidates.find(c => c.label.includes(norm) || norm.includes(c.label));
  if (sub) return sub.option;

  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(norm, c.label);
    if (d < bestDist) { bestDist = d; best = c.option; }
  }
  const threshold = Math.ceil(norm.length * 0.4);
  return bestDist <= threshold ? best : null;
}
