import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { GeneralItemManager } from '@/components/settings/GeneralItemManager';

export default async function GeneralItemsSettingsPage() {
  const session = await getServerSession(authOptions);
  const role    = (session?.user as { role?: UserRole })?.role;
  if (role !== UserRole.ADMIN) redirect('/settings');

  return (
    <div className="max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/settings" className="hover:text-gray-700">Settings</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">General Items</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">General Items</h1>
        <Link href="/settings" className="btn-secondary text-sm">
          ← Back to Settings
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Catalog of items assignable to survey locations on General projects. Cost and default
        quantity seed the cost schedule; both can be adjusted per project.
      </p>

      <div className="card p-6">
        <GeneralItemManager />
      </div>
    </div>
  );
}
