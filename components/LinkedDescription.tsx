'use client';

interface Props {
  description: string | null;
  url?:        string | null;
}

// Ensure a stored URL has a scheme; otherwise the browser treats e.g.
// "www.vendor.com" as a relative path that points back into our own app.
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith('//')) return trimmed;
  return `https://${trimmed}`;
}

export function LinkedDescription({ description, url }: Props) {
  const text = description || '—';
  const href = url ? normalizeUrl(url) : '';

  if (!href) return <span>{text}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline hover:text-blue-800"
      title={href}
    >
      {text}
    </a>
  );
}
