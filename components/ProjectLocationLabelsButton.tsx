'use client';

import { useRef, useState } from 'react';
import { PrinterIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface Props {
  projectId: number;
}

// Avery sizes offered in the picker. 5163/5164 are roomiest and recommended for
// the multi-line label content (name + access method + artifacts + notes).
// rows/cols define the sheet grid and bound the start-position inputs.
const SIZES: { id: string; label: string; rows: number; cols: number }[] = [
  { id: '5163', label: 'Avery 5163 — 2" × 4" (10/sheet)',   rows: 5,  cols: 2 },
  { id: '5164', label: 'Avery 5164 — 3⅓" × 4" (6/sheet)',   rows: 3,  cols: 2 },
  { id: '5161', label: 'Avery 5161 — 1" × 4" (20/sheet)',   rows: 10, cols: 2 },
  { id: '5160', label: 'Avery 5160 — 1" × 2⅝" (30/sheet)',  rows: 10, cols: 3 },
];

export function ProjectLocationLabelsButton({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [sizeId, setSizeId] = useState(SIZES[0].id);
  const [row, setRow] = useState(1);
  const [col, setCol] = useState(1);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];

  // Keep row/col within the selected sheet's grid.
  const clampedRow = Math.min(Math.max(row, 1), size.rows);
  const clampedCol = Math.min(Math.max(col, 1), size.cols);
  const skipped = (clampedRow - 1) * size.cols + (clampedCol - 1);

  const handleSizeChange = (id: string) => {
    const next = SIZES.find((s) => s.id === id) ?? SIZES[0];
    setSizeId(id);
    setRow((r) => Math.min(Math.max(r, 1), next.rows));
    setCol((c) => Math.min(Math.max(c, 1), next.cols));
  };

  const href =
    `/api/projects/${projectId}/location-labels` +
    `?size=${size.id}&row=${clampedRow}&col=${clampedCol}`;

  return (
    <div
      className="relative"
      onMouseLeave={() => {
        closeTimer.current = setTimeout(() => setOpen(false), 200);
      }}
      onMouseEnter={() => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
      }}
    >
      <button
        type="button"
        className="btn-secondary gap-1.5"
        onClick={() => setOpen((o) => !o)}
      >
        <PrinterIcon className="w-4 h-4" />
        Print Location Labels
        <ChevronDownIcon className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 origin-top-right rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Label size
          </label>
          <select
            value={sizeId}
            onChange={(e) => handleSizeChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="mt-3">
            <div className="text-xs font-medium text-gray-500 mb-1">
              Start at label position
            </div>
            <p className="text-xs text-gray-400 mb-2">
              Reuse a partly-used sheet: choose the first open label. Positions
              count left-to-right, top-to-bottom.
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                Row
                <input
                  type="number"
                  min={1}
                  max={size.rows}
                  value={clampedRow}
                  onChange={(e) => setRow(Number(e.target.value) || 1)}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-400">of {size.rows}</span>
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                Col
                <input
                  type="number"
                  min={1}
                  max={size.cols}
                  value={clampedCol}
                  onChange={(e) => setCol(Number(e.target.value) || 1)}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-400">of {size.cols}</span>
              </label>
            </div>
            {skipped > 0 && (
              <p className="mt-1.5 text-xs text-gray-400">
                Skips {skipped} label{skipped === 1 ? '' : 's'} on the first sheet.
              </p>
            )}
          </div>

          <a
            href={href}
            onClick={() => setOpen(false)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <PrinterIcon className="w-4 h-4" />
            Download labels
          </a>
        </div>
      )}
    </div>
  );
}
