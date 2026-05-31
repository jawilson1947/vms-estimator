import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { MicTest } from '@/components/settings/MicTest';
import { InternetCheck } from '@/components/settings/InternetCheck';
import { SpeechApiTest } from '@/components/settings/SpeechApiTest';
import { UserManager } from '@/components/admin/UserManager';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

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

      {isAdmin && (
        <UserManager currentUserId={currentUserId} />
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
    </div>
  );
}
