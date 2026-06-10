import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { UserManager } from '@/components/admin/UserManager';

export default async function UsersSettingsPage() {
  const session = await getServerSession(authOptions);
  const role    = (session?.user as { role?: UserRole })?.role;
  if (role !== UserRole.ADMIN) redirect('/settings');

  const currentUserId = Number((session?.user as { id?: string | number })?.id ?? 0);

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/settings" className="hover:text-gray-700">Settings</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">User Management</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">User Management</h1>
        <Link href="/settings" className="btn-secondary text-sm">
          ← Back to Settings
        </Link>
      </div>

      <UserManager currentUserId={currentUserId} />
    </div>
  );
}
