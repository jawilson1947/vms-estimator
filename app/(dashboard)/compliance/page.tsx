import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ComplianceTable } from '@/components/ComplianceTable';

export const metadata = { title: 'Security Compliance' };

export default async function CompliancePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const cameras = await prisma.camera.findMany({
    select: {
      id: true,
      cameraCode: true,
      cameraName: true,
      status: true,
      ipAddress: true,
      firmwareVersion: true,
      httpsEnabled: true,
      usernameChanged: true,
      privacyMaskEnabled: true,
      installDate: true,
      warrantyExpiration: true,
      location: {
        select: {
          areaName: true,
          building: {
            select: {
              buildingName: true,
              site: {
                select: {
                  siteName: true,
                  customer: { select: { customerName: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { location: { building: { site: { siteName: 'asc' } } } },
      { cameraCode: 'asc' },
    ],
  });

  // Serialise dates for client
  const serialised = cameras.map(c => ({
    ...c,
    installDate:        c.installDate        ? c.installDate.toISOString()        : null,
    warrantyExpiration: c.warrantyExpiration  ? c.warrantyExpiration.toISOString() : null,
  }));

  const total   = cameras.length;
  const https   = cameras.filter(c => c.httpsEnabled).length;
  const userChg = cameras.filter(c => c.usernameChanged).length;
  const privacy = cameras.filter(c => c.privacyMaskEnabled).length;
  const allPass = cameras.filter(c => c.httpsEnabled && c.usernameChanged).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Security Compliance</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Camera-level security configuration status across all sites.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Cameras</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{https}</p>
          <p className="text-xs text-gray-500 mt-0.5">HTTPS Enabled</p>
          <p className="text-xs text-gray-400">{total ? Math.round(https / total * 100) : 0}%</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{userChg}</p>
          <p className="text-xs text-gray-500 mt-0.5">Username Changed</p>
          <p className="text-xs text-gray-400">{total ? Math.round(userChg / total * 100) : 0}%</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{allPass}</p>
          <p className="text-xs text-gray-500 mt-0.5">Fully Compliant</p>
          <p className="text-xs text-gray-400">{total ? Math.round(allPass / total * 100) : 0}%</p>
        </div>
      </div>

      {/* Issues banner */}
      {total > 0 && allPass < total && (
        <div className="mb-5 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <span className="text-amber-500 text-lg leading-none mt-0.5">&#9888;</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {total - allPass} camera{total - allPass !== 1 ? 's' : ''} need attention
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {total - https} without HTTPS &bull; {total - userChg} with default username &bull; {total - privacy} without privacy mask
            </p>
          </div>
        </div>
      )}

      <ComplianceTable cameras={serialised as any} />
    </div>
  );
}
