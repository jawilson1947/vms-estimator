'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import clsx from 'clsx';
import {
  HomeIcon,
  CameraIcon,
  FolderIcon,
  BuildingOffice2Icon,
  WrenchScrewdriverIcon,
  CurrencyDollarIcon,
  DocumentChartBarIcon,
  ShieldCheckIcon,
  UsersIcon,
  Cog6ToothIcon,
  WifiIcon,
  DocumentTextIcon,
  MapPinIcon,
  ShieldExclamationIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';

const nav = [
  { label: 'Survey',      href: '/survey',      icon: MapPinIcon,            color: 'text-teal-500'    },
  { label: 'Dashboard',   href: '/dashboard',   icon: HomeIcon,              color: 'text-blue-500'    },
  { label: 'Cameras',     href: '/cameras',     icon: CameraIcon,            color: 'text-indigo-500'  },
  { label: 'Projects',    href: '/projects',    icon: FolderIcon,            color: 'text-violet-500'  },
  { label: 'Customers',   href: '/customers',   icon: UsersIcon,             color: 'text-orange-500'  },
  { label: 'Sites',       href: '/sites',       icon: BuildingOffice2Icon,   color: 'text-green-500'   },
  { label: 'Maintenance', href: '/maintenance', icon: WrenchScrewdriverIcon, color: 'text-amber-500'   },
  { label: 'Network',     href: '/network',     icon: WifiIcon,              color: 'text-cyan-500'    },
  { label: 'Worksheet',   href: '/worksheet',   icon: DocumentTextIcon,      color: 'text-sky-500'     },
  { label: 'Compliance',  href: '/compliance',  icon: ShieldCheckIcon,       color: 'text-emerald-500' },
  { label: 'Costs',       href: '/costs',       icon: CurrencyDollarIcon,    color: 'text-lime-600'    },
  { label: 'Reports',     href: '/reports',     icon: DocumentChartBarIcon,  color: 'text-purple-500'  },
  { label: 'Settings',    href: '/settings',    icon: Cog6ToothIcon,         color: 'text-gray-400'    },
];

const adminNav = [
  { label: 'Admin', href: '/admin', icon: ShieldExclamationIcon, color: 'text-gray-400' },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className="w-40 shrink-0 bg-gray-900 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-800">
        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center shrink-0">
          <CameraIcon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-white font-bold text-xs tracking-wide">CSMS</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-1.5 py-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ label, href, icon: Icon, color }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className={clsx('w-3.5 h-3.5 shrink-0', active ? 'text-white' : color)} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Log off */}
      <div className="px-1.5 pb-1 border-t border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors mt-0.5"
        >
          <ArrowRightStartOnRectangleIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          Log Off
        </button>
      </div>

      {/* Admin nav */}
      <div className="px-1.5 py-2 border-t border-gray-800 space-y-0.5">
        {adminNav.map(({ label, href, icon: Icon, color }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className={clsx('w-3.5 h-3.5 shrink-0', active ? 'text-white' : color)} />
              {label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
