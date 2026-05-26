'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from '@heroicons/react/24/outline';

const nav = [
  { label: 'Dashboard',   href: '/dashboard',   icon: HomeIcon },
  { label: 'Cameras',     href: '/cameras',      icon: CameraIcon },
  { label: 'Projects',    href: '/projects',     icon: FolderIcon },
  { label: 'Customers',   href: '/customers',    icon: UsersIcon },
  { label: 'Sites',       href: '/sites',        icon: BuildingOffice2Icon },
  { label: 'Maintenance', href: '/maintenance',  icon: WrenchScrewdriverIcon },
  { label: 'Network',     href: '/network',      icon: WifiIcon },
  { label: 'Worksheet',   href: '/worksheet',    icon: DocumentTextIcon },
  { label: 'Compliance',  href: '/compliance',   icon: ShieldCheckIcon },
  { label: 'Costs',       href: '/costs',        icon: CurrencyDollarIcon },
  { label: 'Reports',     href: '/reports',      icon: DocumentChartBarIcon },
];

const adminNav = [
  { label: 'Admin',       href: '/admin',        icon: Cog6ToothIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className="w-56 shrink-0 bg-gray-900 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <CameraIcon className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-bold text-sm tracking-wide">CSMS</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Admin nav */}
      <div className="px-2 py-3 border-t border-gray-800 space-y-0.5">
        {adminNav.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
