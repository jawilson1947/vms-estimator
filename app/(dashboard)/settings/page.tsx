import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  BuildingOfficeIcon,
  UsersIcon,
  ListBulletIcon,
  ClipboardDocumentListIcon,
  MicrophoneIcon,
  WifiIcon,
  ChatBubbleBottomCenterTextIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

interface MenuItem {
  href:        string;
  icon:        React.ElementType;
  iconBg:      string;
  iconColor:   string;
  title:       string;
  description: string;
  adminOnly?:  boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    href:        '/settings/company',
    icon:        BuildingOfficeIcon,
    iconBg:      'bg-blue-50',
    iconColor:   'text-blue-600',
    title:       'Company Profile',
    description: 'Name, logo, address and contact details shown on proposals',
  },
  {
    href:        '/settings/users',
    icon:        UsersIcon,
    iconBg:      'bg-violet-50',
    iconColor:   'text-violet-600',
    title:       'User Management',
    description: 'Create, edit and deactivate user accounts',
    adminOnly:   true,
  },
  {
    href:        '/settings/categories',
    icon:        ListBulletIcon,
    iconBg:      'bg-amber-50',
    iconColor:   'text-amber-600',
    title:       'Line Item Categories',
    description: 'Manage the category list used in cost estimates',
    adminOnly:   true,
  },
  {
    href:        '/settings/access-methods',
    icon:        LockClosedIcon,
    iconBg:      'bg-fuchsia-50',
    iconColor:   'text-fuchsia-600',
    title:       'Access Methods',
    description: 'Door templates and their default bill of materials',
    adminOnly:   true,
  },
  {
    href:        '/settings/survey-management',
    icon:        ClipboardDocumentListIcon,
    iconBg:      'bg-teal-50',
    iconColor:   'text-teal-600',
    title:       'Survey Management',
    description: 'Copy, move or delete survey locations across projects',
  },
  {
    href:        '/settings/mic-test',
    icon:        MicrophoneIcon,
    iconBg:      'bg-rose-50',
    iconColor:   'text-rose-600',
    title:       'Microphone Test',
    description: 'Record and play back audio to verify your microphone',
  },
  {
    href:        '/settings/connectivity',
    icon:        WifiIcon,
    iconBg:      'bg-green-50',
    iconColor:   'text-green-600',
    title:       'Internet & Connectivity',
    description: 'Check browser, server and external internet reachability',
  },
  {
    href:        '/settings/speech',
    icon:        ChatBubbleBottomCenterTextIcon,
    iconBg:      'bg-sky-50',
    iconColor:   'text-sky-600',
    title:       'Speech API Diagnostic',
    description: 'Test browser speech recognition for voice input features',
  },
];

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const role    = (session?.user as { role?: UserRole })?.role;
  const isAdmin = role === UserRole.ADMIN;

  const visibleItems = MENU_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-2">
        {visibleItems.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="card p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className={`w-10 h-10 ${item.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${item.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                  {item.title}
                  {item.adminOnly && (
                    <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
