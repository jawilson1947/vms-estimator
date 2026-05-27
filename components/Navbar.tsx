'use client';

import { useSession, signOut } from 'next-auth/react';
import { Fragment, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { UserCircleIcon, ChevronDownIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { VoiceMic } from '@/components/VoiceMic';
import { useVoice } from '@/context/VoiceContext';

const roleLabels: Record<string, string> = {
  ADMIN:           'Administrator',
  PROJECT_MANAGER: 'Project Manager',
  TECHNICIAN:      'Technician',
  VIEWER:          'Viewer',
};

export function Navbar() {
  const { data: session } = useSession();
  const { setSites } = useVoice();

  // Load sites list once so "start survey for X" can resolve building names
  useEffect(() => {
    fetch('/api/survey/sites-list')
      .then(r => r.ok ? r.json() : [])
      .then(setSites)
      .catch(() => {});
  }, [setSites]);

  return (
    <header className="h-9 bg-white border-b border-gray-200 flex items-center justify-between px-3 shrink-0">
      {/* Voice mic indicator */}
      <VoiceMic />

      {/* User menu */}
      <Menu as="div" className="relative">
        <Menu.Button className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors">
          <UserCircleIcon className="w-4 h-4 text-gray-400" />
          <span>{session?.user?.name ?? 'User'}</span>
          {session?.user?.role && (
            <span className="badge bg-blue-50 text-blue-700 text-xs">
              {roleLabels[session.user.role] ?? session.user.role}
            </span>
          )}
          <ChevronDownIcon className="w-3 h-3 text-gray-400" />
        </Menu.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50 outline-none">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">Signed in as</p>
              <p className="text-xs font-medium text-gray-900 truncate">{session?.user?.email}</p>
            </div>
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className={`${active ? 'bg-gray-50' : ''} flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700`}
                >
                  <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
                  Sign out
                </button>
              )}
            </Menu.Item>
          </Menu.Items>
        </Transition>
      </Menu>
    </header>
  );
}
