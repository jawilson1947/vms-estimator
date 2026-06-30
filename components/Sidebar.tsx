'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import clsx from 'clsx';
import {
  HomeIcon,
  CameraIcon,
  FolderIcon,
  BuildingOffice2Icon,
  CurrencyDollarIcon,
  DocumentChartBarIcon,
  UsersIcon,
  Cog6ToothIcon,
  MapPinIcon,
  ShieldExclamationIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentPlusIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';

const nav = [
  { label: 'Survey',      href: '/survey',      icon: MapPinIcon,            color: 'text-teal-500'    },
  { label: 'Dashboard',   href: '/dashboard',   icon: HomeIcon,              color: 'text-blue-500'    },
  { label: 'Cameras',     href: '/cameras',     icon: CameraIcon,            color: 'text-indigo-500'  },
  { label: 'Artifacts',   href: '/artifacts',   icon: KeyIcon,               color: 'text-fuchsia-500' },
  { label: 'Projects',    href: '/projects',    icon: FolderIcon,            color: 'text-violet-500'  },
  { label: 'Customers',   href: '/customers',   icon: UsersIcon,             color: 'text-orange-500'  },
  { label: 'Sites',       href: '/sites',       icon: BuildingOffice2Icon,   color: 'text-green-500'   },
  { label: 'Costs',       href: '/costs',       icon: CurrencyDollarIcon,    color: 'text-lime-600'    },
  { label: 'Proposals',  href: '/proposals',   icon: DocumentPlusIcon,      color: 'text-rose-500'    },
  { label: 'Reports',     href: '/reports',     icon: DocumentChartBarIcon,  color: 'text-purple-500'  },
  { label: 'Settings',    href: '/settings',    icon: Cog6ToothIcon,         color: 'text-gray-400'    },
];

const adminNav = [
  { label: 'Admin', href: '/admin', icon: ShieldExclamationIcon, color: 'text-gray-400' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Restore persisted state on mount
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  function toggle() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Shared link/button classes
  function itemClass(active: boolean) {
    return clsx(
      'flex items-center rounded-md text-xs font-medium transition-colors',
      collapsed ? 'justify-center px-2 py-1.5' : 'gap-2 px-2 py-1.5',
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    );
  }

  return (
    <aside
      className={clsx(
        'shrink-0 bg-gray-900 min-h-screen flex flex-col transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-12' : 'w-40'
      )}
    >
      {/* Logo row + collapse toggle */}
      <div className="flex items-center justify-between px-2 py-3 border-b border-gray-800 min-h-[44px]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center shrink-0">
              <CameraIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold text-xs tracking-wide">CSMS</span>
          </div>
        )}

        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx(
            'flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-800 hover:text-white transition-colors p-1',
            collapsed && 'w-full'
          )}
        >
          {collapsed
            ? <ChevronRightIcon className="w-4 h-4" />
            : <ChevronLeftIcon  className="w-4 h-4" />}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-1.5 py-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ label, href, icon: Icon, color }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={itemClass(active)}
            >
              <Icon className={clsx('w-3.5 h-3.5 shrink-0', active ? 'text-white' : color)} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Log off */}
      <div className="px-1.5 pb-1 border-t border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={collapsed ? 'Log Off' : undefined}
          className={clsx(
            'w-full flex items-center rounded-md text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors mt-0.5',
            collapsed ? 'justify-center px-2 py-1.5' : 'gap-2 px-2 py-1.5'
          )}
        >
          <ArrowRightStartOnRectangleIcon className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && 'Log Off'}
        </button>
      </div>

    </aside>
  );
}
