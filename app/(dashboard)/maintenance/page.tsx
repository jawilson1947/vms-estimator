import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  WrenchScrewdriverIcon, ExclamationTriangleIcon,
  ClockIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { addDays, isPast, isWithinInterval } from 'date-fns';

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type Due = 'OVERDUE' | 'SOON' | 'OK';

function dueStatus(nextDue: Date | null): Due {
  if (!nextDue) return 'OK';
  if (isPast(nextDue)) return 'OVERDUE';
  if (isWithinInterval(nextDue, { start: new Date(), end: addDays(new Date(), 30) })) return 'SOON';
  return 'OK';
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = (searchParams.filter ?? 'all') as 'all' | 'overdue' | 'soon' | 'none';

  // Get all cameras with latest maintenance record
  const cameras = await prisma.camera.findMany({
    include: {
      model: { select: { manufacturer: true, modelNumber: true } },
      location: { include: { building: { include: { site: { select: { siteName: true } } } } } },
      maintenanceRecords: { orderBy: { serviceDate: 'desc' }, take: 1 },
    },
    orderBy: { cameraCode: 'asc' },
  });

  const enriched = cameras.map(c => {
    const latest = c.maintenanceRecords[0] ?? null;
    const nextDue = latest?.nextServiceDue ?? null;
    return { ...c, latest, nextDue, due: dueStatus(nextDue) };
  });

  const overdue = enriched.filter(c => c.due === 'OVERDUE');
  const soon    = enriched.filter(c => c.due === 'SOON');
  const none    = enriched.filter(c => !c.latest);

  const displayed = filter === 'overdue' ? overdue
    : filter === 'soon'    ? soon
    : filter === 'none'    ? none
    : enriched;

  const FILTERS = [
    { key: 'all',     label: 'All Cameras',   count: enriched.length,   color: 'text-gray-600' },
    { key: 'overdue', label: 'Overdue',        count: overdue.length,    color: 'text-red-600' },
    { key: 'soon',    label: 'Due in 30 days', count: soon.length,       color: 'text-amber-600' },
    { key: 'none',    label: 'Never Serviced', count: none.length,       color: 'text-blue-600' },
  ] as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Maintenance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Service history and upcoming maintenance schedules.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {FILTERS.map(f => (
          <Link
            key={f.key}
            href={`/maintenance?filter=${f.key}`}
            className={`card p-4 text-center hover:shadow-md transition-shadow ${filter === f.key ? 'ring-2 ring-blue-500' : ''}`}
          >
            <p className={`text-2xl font-bold ${f.color}`}>{f.count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{f.label}</p>
          </Link>
        ))}
      </div>

      {/* Overdue alert banner */}
      {overdue.length > 0 && filter !== 'overdue' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{overdue.length} camera{overdue.length !== 1 ? 's are' : ' is'} overdue</strong> for service.{' '}
            <Link href="/maintenance?filter=overdue" className="underline">View overdue →</Link>
          </p>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckCircleIcon className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">No cameras match this filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Camera</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Last Service</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Technician</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Next Due</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map(c => {
                const DUE_BADGE = c.due === 'OVERDUE'
                  ? <span className="badge bg-red-50 text-red-700 flex items-center gap-1"><ExclamationTriangleIcon className="w-3 h-3" />Overdue</span>
                  : c.due === 'SOON'
                  ? <span className="badge bg-amber-50 text-amber-700 flex items-center gap-1"><ClockIcon className="w-3 h-3" />Due Soon</span>
                  : c.latest
                  ? <span className="badge bg-green-50 text-green-700">Scheduled</span>
                  : <span className="badge bg-gray-100 text-gray-500">No Record</span>;

                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/cameras/${c.id}`} className="font-medium text-blue-600 hover:underline">
                        {c.cameraName}
                      </Link>
                      <p className="text-xs text-gray-400 font-mono">{c.cameraCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.location ? (
                        <>
                          <span>{c.location.building.site.siteName}</span>
                          <span className="text-gray-400"> › {c.location.building.buildingName}</span>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.latest ? (
                        <>
                          <span>{fmtDate(c.latest.serviceDate)}</span>
                          {c.latest.serviceType && (
                            <p className="text-xs text-gray-400">{c.latest.serviceType}</p>
                          )}
                        </>
                      ) : <span className="text-gray-400">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.latest?.technician ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.nextDue ? fmtDate(c.nextDue) : '—'}
                    </td>
                    <td className="px-4 py-3">{DUE_BADGE}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
