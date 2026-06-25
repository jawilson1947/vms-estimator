'use client';

import { Menu } from '@headlessui/react';
import { PrinterIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface Props {
  projectId: number;
}

// Avery sizes offered in the picker. 5163/5164 are roomiest and recommended for
// the multi-line label content (name + access method + artifacts + notes).
const SIZES: { id: string; label: string }[] = [
  { id: '5163', label: 'Avery 5163 — 2" × 4" (10/sheet)' },
  { id: '5164', label: 'Avery 5164 — 3⅓" × 4" (6/sheet)' },
  { id: '5161', label: 'Avery 5161 — 1" × 4" (20/sheet)' },
  { id: '5160', label: 'Avery 5160 — 1" × 2⅝" (30/sheet)' },
];

export function ProjectLocationLabelsButton({ projectId }: Props) {
  return (
    <Menu as="div" className="relative">
      <Menu.Button className="btn-secondary gap-1.5">
        <PrinterIcon className="w-4 h-4" />
        Print Location Labels
        <ChevronDownIcon className="w-3.5 h-3.5" />
      </Menu.Button>

      <Menu.Items className="absolute right-0 z-20 mt-1 w-72 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none">
        <div className="px-3 py-1.5 text-xs font-medium text-gray-400">Choose label size</div>
        {SIZES.map((s) => (
          <Menu.Item key={s.id}>
            {({ active }: { active: boolean }) => (
              <a
                href={`/api/projects/${projectId}/location-labels?size=${s.id}`}
                className={`block px-3 py-2 text-sm ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
              >
                {s.label}
              </a>
            )}
          </Menu.Item>
        ))}
      </Menu.Items>
    </Menu>
  );
}
