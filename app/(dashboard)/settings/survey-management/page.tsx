import { prisma } from '@/lib/prisma';
import { SurveyManagementPanel } from '@/components/SurveyManagementPanel';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';

export default async function SurveyManagementPage() {
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
        <span className="text-gray-900 font-medium">Survey Management</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ClipboardDocumentListIcon className="w-5 h-5 text-teal-500" />
          <h1 className="text-xl font-bold text-gray-900">Survey Management</h1>
        </div>
        <Link href="/settings" className="btn-secondary text-sm">
          ← Back to Settings
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Select a project to copy, move, or delete its survey locations. Photos are included in all operations.
      </p>

      <SurveyManagementPanel projects={projects} />
    </div>
  );
}
