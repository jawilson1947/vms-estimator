import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { MicTest } from '@/components/settings/MicTest';
import { InternetCheck } from '@/components/settings/InternetCheck';
import { SpeechApiTest } from '@/components/settings/SpeechApiTest';
import { UserManager } from '@/components/admin/UserManager';
import { LineItemCategoryManager } from '@/components/settings/LineItemCategoryManager';
import { CompanySettings } from '@/components/settings/CompanySettings';
import { Cog6ToothIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as UserRole | undefined;
  const isAdmin = role === UserRole.ADMIN;
  const currentUserId = Number((session?.user as any)?.id ?? 0);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Cog6ToothIcon className="w-5 h-5 text-gray-400" />
        <h1 className="text-base font-semibold text-gray-900">Settings</h1>
      </div>

      <div className="card p-4">
        <CompanySettings />
      </div>

      {isAdmin && (
        <UserManager currentUserId={currentUserId} />
      )}

      {isAdmin && (
        <div className="card p-4">
          <LineItemCategoryManager />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <MicTest />
        </div>
        <div className="card p-4">
          <InternetCheck />
        </div>
      </div>

      <div className="card p-4">
        <SpeechApiTest />
      </div>

      <Link
        href="/settings/survey-management"
        className="card p-5 flex items-center gap-4 hover:border-teal-300 hover:shadow-sm transition-all group"
      >
        <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
          <ClipboardDocumentListIcon className="w-5 h-5 text-teal-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">Survey Management</p>
          <p className="text-xs text-gray-500 mt-0.5">Copy, move, or delete survey locations across projects</p>
        </div>
        <span className="text-xs text-teal-600 font-medium group-hover:underline">Open →</span>
      </Link>
    </div>
  );
}
