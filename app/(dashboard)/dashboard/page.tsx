import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  CameraIcon,
  FolderIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

async function getStats() {
  const [
    totalCameras,
    totalLocations,
    assignedLocations,
    totalProjects,
    inProgressProjects,
    totalCustomers,
  ] = await Promise.all([
    prisma.cameraModel.count(),
    prisma.cameraLocation.count(),
    prisma.cameraLocation.count({ where: { cameraModelId: { not: null } } }),
    prisma.project.count(),
    prisma.project.count({ where: { projectStatus: 'IN_PROGRESS' } }),
    prisma.customer.count(),
  ]);

  return {
    totalCameras,
    totalLocations,
    assignedLocations,
    totalProjects,
    inProgressProjects,
    totalCustomers,
    maintenanceDue: 0,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const stats   = await getStats();

  const widgets = [
    {
      label:    'Camera Models',
      value:    stats.totalCameras,
      sub:      'In catalog',
      icon:     CameraIcon,
      color:    'blue',
    },
    {
      label:    'Survey Locations',
      value:    stats.totalLocations,
      sub:      `${stats.assignedLocations} assigned`,
      icon:     ExclamationTriangleIcon,
      color:    'indigo',
    },
    {
      label:    'Projects',
      value:    stats.totalProjects,
      sub:      `${stats.inProgressProjects} in progress`,
      icon:     FolderIcon,
      color:    'indigo',
    },
    {
      label:    'Customers',
      value:    stats.totalCustomers,
      sub:      'Active accounts',
      icon:     UsersIcon,
      color:    'violet',
    },
    {
      label:    'Maintenance Due',
      value:    stats.maintenanceDue,
      sub:      'Past due date',
      icon:     WrenchScrewdriverIcon,
      color:    stats.maintenanceDue > 0 ? 'amber' : 'green',
    },
    {
      label:    'System Status',
      value:    'Online',
      sub:      'All services running',
      icon:     CheckCircleIcon,
      color:    'green',
    },
  ];

  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    red:    'bg-red-50 text-red-600',
    green:  'bg-green-50 text-green-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    violet: 'bg-violet-50 text-violet-600',
    amber:  'bg-amber-50 text-amber-600',
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Welcome back, {session?.user?.name}. Here&apos;s your system overview.
        </p>
      </div>

      {/* Stat widgets */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {widgets.map(w => (
          <div key={w.label} className="card p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colorMap[w.color]}`}>
              <w.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{w.value}</p>
            <p className="text-xs font-medium text-gray-600 mt-0.5">{w.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{w.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Add a camera model',  href: '/cameras' },
              { label: 'Create a project',   href: '/projects/new' },
              { label: 'Add a customer',     href: '/customers/new' },
              { label: 'Log maintenance',    href: '/maintenance/new' },
              { label: 'View cost reports',  href: '/costs' },
            ].map(link => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center justify-between text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                {link.label}
                <span aria-hidden>→</span>
              </a>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">System Summary</h2>
          <dl className="space-y-2">
            {[
              { label: 'Camera models in catalog', value: stats.totalCameras },
              { label: 'Survey locations',         value: stats.totalLocations },
              { label: 'Locations w/ camera',      value: stats.assignedLocations },
              { label: 'Projects total',           value: stats.totalProjects },
              { label: 'In-progress projects',     value: stats.inProgressProjects },
              { label: 'Customers',                value: stats.totalCustomers },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <dt className="text-gray-500">{item.label}</dt>
                <dd className="font-medium text-gray-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
