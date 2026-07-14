import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { authOptions, canEdit } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CostManagementPanel } from '@/components/CostManagementPanel';
import { CurrencyDollarIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CostManagementPage() {
  const session = await getServerSession(authOptions);
  const role    = (session?.user as { role?: UserRole })?.role;
  if (!role || !canEdit(role)) redirect('/settings');

  const projects = await prisma.project.findMany({
    orderBy: { projectName: 'asc' },
    select: {
      id:          true,
      projectName: true,
      building: {
        select: {
          buildingName: true,
          site: { select: { siteName: true } },
        },
      },
    },
  });

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/settings" className="hover:text-gray-700">Settings</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Cost Item Management</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CurrencyDollarIcon className="w-5 h-5 text-emerald-500" />
          <h1 className="text-xl font-bold text-gray-900">Cost Item Management</h1>
        </div>
        <Link href="/settings" className="btn-secondary text-sm">
          ← Back to Settings
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Select a project to copy its cost line items to another project. Values are copied as-is.
        Survey items are excluded — use Survey Management for those.
      </p>

      <CostManagementPanel projects={projects} />
    </div>
  );
}
