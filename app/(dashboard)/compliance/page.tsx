import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export const metadata = { title: 'Security Compliance' };

export default async function CompliancePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Security Compliance</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Compliance tracking has been updated — individual camera instance tracking removed.
        </p>
      </div>
      <div className="card p-12 text-center">
        <ShieldCheckIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          Compliance reporting will be redesigned around the new camera catalog model.
        </p>
      </div>
    </div>
  );
}
