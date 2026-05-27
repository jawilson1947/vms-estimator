import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  ChevronRightIcon, PencilSquareIcon, PlusIcon,
  BuildingOffice2Icon, MapPinIcon, CameraIcon,
} from '@heroicons/react/24/outline';
import { AddBuildingForm } from '@/components/AddBuildingForm';
import { BuildingActions } from '@/components/BuildingActions';
import { BuildingFloorPlans } from '@/components/BuildingFloorPlans';

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where:   { id: Number(id) },
    include: {
      customer: { select: { id: true, customerName: true } },
      project:  { select: { id: true, projectName:  true } },
      buildings: {
        orderBy: { buildingName: 'asc' },
        include: {
          locations: {
            orderBy: { areaName: 'asc' },
            include: { _count: { select: { cameras: true } } },
          },
          _count: { select: { locations: true } },
        },
      },
    },
  });

  if (!site) notFound();

  const totalCameras = site.buildings.reduce(
    (sum, b) => sum + b.locations.reduce((s, l) => s + l._count.cameras, 0), 0
  );

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/sites" className="hover:text-gray-700">Sites</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{site.siteName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{site.siteName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {[site.address, site.city, site.state].filter(Boolean).join(', ')}
          </p>
        </div>
        <Link href={`/sites/${site.id}/edit`} className="btn-secondary">
          <PencilSquareIcon className="w-4 h-4" /> Edit
        </Link>
      </div>

      {/* Info row */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <BuildingOffice2Icon className="w-8 h-8 text-blue-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{site.buildings.length}</p>
            <p className="text-xs text-gray-500">Buildings</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <MapPinIcon className="w-8 h-8 text-indigo-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {site.buildings.reduce((s, b) => s + b._count.locations, 0)}
            </p>
            <p className="text-xs text-gray-500">Camera Locations</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <CameraIcon className="w-8 h-8 text-green-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalCameras}</p>
            <p className="text-xs text-gray-500">Cameras</p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-3 text-sm mb-6">
        {site.customer && (
          <Link href={`/customers/${site.customer.id}`} className="text-blue-600 hover:underline">
            ← {site.customer.customerName}
          </Link>
        )}
        {site.project && (
          <Link href={`/projects/${site.project.id}`} className="text-blue-600 hover:underline">
            ← {site.project.projectName}
          </Link>
        )}
      </div>

      {/* Buildings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Buildings</h2>
        </div>

        {site.buildings.map(building => (
          <div key={building.id} className="card overflow-hidden">
            <div className="group flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <BuildingOffice2Icon className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900 text-sm">{building.buildingName}</span>
                <span className="badge bg-gray-100 text-gray-500 text-xs">
                  {building._count.locations} location{building._count.locations !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <BuildingActions buildingId={building.id} buildingName={building.buildingName} />
                <Link
                  href={`/cameras?buildingId=${building.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  View cameras
                </Link>
              </div>
            </div>

            {/* Floor plans */}
            <div className="px-5 py-3 border-b border-gray-100">
              <BuildingFloorPlans buildingId={building.id} />
            </div>

            {building.locations.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">No camera locations yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Area</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Floor</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Mounting</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Coverage Purpose</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Cameras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {building.locations.map(loc => (
                    <tr key={loc.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 font-medium text-gray-800">{loc.areaName ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{loc.floor ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{loc.mountingLocation ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{loc.coveragePurpose ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="badge bg-blue-50 text-blue-700">{loc._count.cameras}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {/* Add building form */}
        <AddBuildingForm siteId={site.id} />
      </div>
      {site.notes && (
        <div className="card p-5 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{site.notes}</p>
        </div>
      )}
    </div>
  );
}
