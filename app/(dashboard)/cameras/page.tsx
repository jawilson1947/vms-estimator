import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PlusIcon, CameraIcon } from '@heroicons/react/24/outline';
import { CameraStatus } from '@prisma/client';

const statusColors: Record<string, string> = {
  PLANNED:      'bg-gray-100 text-gray-600',
  INSTALLED:    'bg-blue-50 text-blue-700',
  ACTIVE:       'bg-green-50 text-green-700',
  OFFLINE:      'bg-red-50 text-red-600',
  NEEDS_REPAIR: 'bg-amber-50 text-amber-700',
  RETIRED:      'bg-gray-100 text-gray-400',
};

const statusLabels: Record<string, string> = {
  PLANNED: 'Planned', INSTALLED: 'Installed', ACTIVE: 'Active',
  OFFLINE: 'Offline', NEEDS_REPAIR: 'Needs Repair', RETIRED: 'Retired',
};

async function getCameras(search: string, status: string, buildingId: string) {
  return prisma.camera.findMany({
    where: {
      ...(status     ? { status: status as CameraStatus }                   : {}),
      ...(buildingId ? { location: { buildingId: Number(buildingId) } }     : {}),
      ...(search
        ? { OR: [
            { cameraCode: { contains: search } },
            { cameraName: { contains: search } },
            { ipAddress:  { contains: search } },
          ]}
        : {}),
    },
    include: {
      model:    { select: { manufacturer: true, modelNumber: true, cameraType: true } },
      location: { select: { areaName: true, floor: true,
        building: { select: { buildingName: true,
          site: { select: { siteName: true } } } } } },
    },
    orderBy: { cameraCode: 'asc' },
  });
}

export default async function CamerasPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; buildingId?: string };
}) {
  const search     = searchParams.search     ?? '';
  const status     = searchParams.status     ?? '';
  const buildingId = searchParams.buildingId ?? '';
  const cameras    = await getCameras(search, status, buildingId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Camera Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cameras.length} cameras</p>
        </div>
        <Link href="/cameras/new" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Add Camera
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-4">
        <input name="search" defaultValue={search} placeholder="Search code, name, IP…" className="form-input w-52" />
        <select name="status" defaultValue={status} className="form-select w-40">
          <option value="">All Statuses</option>
          {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
        {(search || status || buildingId) && <Link href="/cameras" className="btn-secondary">Clear</Link>}
      </form>

      {cameras.length === 0 ? (
        <div className="card p-12 text-center">
          <CameraIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {search || status ? 'No cameras match your filters.' : 'No cameras yet.'}
          </p>
          {!search && !status && (
            <Link href="/cameras/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-4 h-4" /> Add first camera
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Model</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">IP Address</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">NVR</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cameras.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/cameras/${c.id}`} className="font-mono font-medium text-blue-600 hover:underline">
                      {c.cameraCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{c.cameraName}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {c.model ? `${c.model.manufacturer ?? ''} ${c.model.modelNumber ?? ''}`.trim() : '—'}
                    {c.model?.cameraType && (
                      <span className="ml-1 badge bg-gray-100 text-gray-500">{c.model.cameraType}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {c.location
                      ? <>
                          <div>{c.location.building?.site?.siteName}</div>
                          <div className="text-gray-400">{c.location.building?.buildingName} · {c.location.areaName}</div>
                        </>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs">{c.ipAddress ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.nvrName ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge ${statusColors[c.status]}`}>{statusLabels[c.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
