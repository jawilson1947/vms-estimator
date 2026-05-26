'use client';

import { useState } from 'react';
import { UsersIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { UserManager } from '@/components/UserManager';
import { AuditLogViewer } from '@/components/AuditLogViewer';

type Tab = 'users' | 'audit';

interface Props {
  initialUsers: any[];
  currentUserId: number;
}

export function AdminTabs({ initialUsers, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>('users');

  const tabs: { key: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'users', label: 'Users',     Icon: UsersIcon },
    { key: 'audit', label: 'Audit Log', Icon: ClipboardDocumentListIcon },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <UserManager initialUsers={initialUsers} currentUserId={currentUserId} />
      )}
      {tab === 'audit' && (
        <AuditLogViewer />
      )}
    </div>
  );
}
