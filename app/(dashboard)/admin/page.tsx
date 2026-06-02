import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  ShieldCheckIcon, UsersIcon, ServerStackIcon,
  CameraIcon, FolderIcon, ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { UserManager } from '@/components/UserManager';
import { AdminTabs } from '@/components/AdminTabs';

export const metadata = { title: 'Admin' };

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if ((session.user as any)?.role !== 'ADMIN') redirect('/dashboard');

  const [users, stats] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, firstName: true, lastName: true,
        username: true, email: true, role: true,
        isActive: true, lastLogin: true, createdAt: true,
      },
      orderBy: { username: 'asc' },
    }),
    Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.cameraModel.count(),
      prisma.project.count(),
    ]),
  ]);

  const [totalUsers, activeUsers, totalCameras, totalProjects] = stats;
  const currentUserId = (session.user as any)?.id as number;

  const serialisedUsers = users.map(u => ({
    ...u,
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
          <ShieldCheckIcon className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500">System settings and user management.</p>
        </div>
      </div>

      {/* System stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <UsersIcon className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{totalUsers}</p>
          <p className="text-xs text-gray-500">{activeUsers} active</p>
        </div>
        <div className="card p-4 text-center">
          <CameraIcon className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{totalCameras}</p>
          <p className="text-xs text-gray-500">Total cameras</p>
        </div>
        <div className="card p-4 text-center">
          <FolderIcon className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{totalProjects}</p>
          <p className="text-xs text-gray-500">Total projects</p>
        </div>
        <div className="card p-4 text-center">
          <ServerStackIcon className="w-5 h-5 text-violet-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">MySQL</p>
          <p className="text-xs text-gray-500">cctv_inventory</p>
        </div>
      </div>
      {/* Tabs: Users | Audit Log */}
      <AdminTabs
        initialUsers={serialisedUsers as any}
        currentUserId={currentUserId}
      />
    </div>
  );
}
