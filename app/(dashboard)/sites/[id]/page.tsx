import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  ChevronRightIcon, PencilSquareIcon,
  BuildingOffice2Icon, MapPinIcon, CameraIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import { AddBuildingForm } from '@/components/AddBuildingForm';
import { BuildingActions } from '@/components/BuildingActions';
import { BuildingFloorPlans } from '@/components/BuildingFloorPlans';
import { LinkToProjectButton } from '@/components/LinkToProjectButton';
import { ProjectLocationsList } from '@/components/ProjectLocationsList';

const BUILDINGS_PER_PAGE = 6;

interface ProjectRow { id: number; projectName: string; }

export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const siteId = Number(id);
  const pageParam = Number((await searchParams).page) || 1;

  const [site, linkedProjects] = await Promise.all([
    prisma.site.findUnique({
      where:   { id: siteId },
      include: {
        customer: { select: { id: true, customerName: true } },
        buildings: {
          orderBy: { buildingName: 'asc' },
          include: {
            projects: {
              include: {
                cameraLocations: {
                  orderBy: { areaName: 'asc' },
                  select: {
                    id: true, areaName: true, floor: true,
                    mountingLocation: true, coveragePurpose: true,
                    cameraModelId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.$queryRaw<ProjectRow[]>(
      Prisma.sql`SELECT p.project_id AS id, p.project_name AS projectName
                 FROM projects p
                 JOIN buildings b ON b.building_id = p.building_id
                 WHERE b.site_id = ${siteId}`
    ).catch(() => [] as ProjectRow[]),
  ]);

  if (!site) notFound();

  const totalPages    = Math.max(1, Math.ceil(site.buildings.length / BUILDINGS_PER_PAGE));
  const currentPage   = Math.min(Math.max(1, pageParam), totalPages);
  const pageBuildings = site.buildings.slice(
    (currentPage - 1) * BUILDINGS_PER_PAGE,
    currentPage * BUILDINGS_PER_PAGE
  );

  const totalCameras = site.buildings.reduce(
    (sum, b) => sum + b.projects.flatMap(p => p.cameraLocations).filter(l => l.cameraModelId !== null).length, 0
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
              {site.buildings.reduce((s, b) => s + b.projects.reduce((ps, p) => ps + p.cameraLocations.length, 0), 0)}
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

      {/* Project links */}
      <div className="flex flex-wrap items-center gap-3 text-sm mb-6">
        {site.customer && (
          <Link href={`/customers/${site.customer.id}`} className="text-blue-600 hover:underline">
            &larr; {site.customer.customerName}
          </Link>
        )}
        {linkedProjects.map(p => (
          <Link key={p.id} href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
            &larr; {p.projectName}
          </Link>
        ))}
        <LinkToProjectButton
          siteId={siteId}
          excludeIds={linkedProjects.map(p => p.id)}
        />
      </div>

      {/* Buildings */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Buildings</h2>

        <AddBuildingForm siteId={site.id} />

        {pageBuildings.map(building => {
          const bLocations = building.projects.flatMap(p => p.cameraLocations);
          return (
            <div key={building.id} className="card overflow-hidden">
              <div className="group flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <BuildingOffice2Icon className="w-4 h-4 text-gray-400" />
                  <Link href={`/buildings/${building.id}`} className="font-semibold text-gray-900 text-sm hover:text-blue-700 hover:underline">
                    {building.buildingName}
                  </Link>
                  <span className="badge bg-gray-100 text-gray-500 text-xs">
                    {bLocations.length} location{bLocations.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <BuildingActions buildingId={building.id} buildingName={building.buildingName} />
                  <Link href={`/cameras?buildingId=${building.id}`} className="text-xs text-blue-600 hover:underline">
                    View cameras
                  </Link>
                </div>
              </div>

              <div className="px-5 py-3 border-b border-gray-100">
                <BuildingFloorPlans buildingId={building.id} />
              </div>

              {bLocations.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">No camera locations yet.</p>
              ) : (
                <div className="px-5 py-3">
                  <ProjectLocationsList locations={bLocations} className="max-w-md" />
                </div>
              )}
            </div>
          );
        })}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {(currentPage - 1) * BUILDINGS_PER_PAGE + 1}–{Math.min(currentPage * BUILDINGS_PER_PAGE, site.buildings.length)} of {site.buildings.length} buildings
            </span>
            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link href={`/sites/${siteId}?page=${currentPage - 1}`} title="Previous page"
                  className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100">
                  <ChevronLeftIcon className="w-4 h-4" />
                </Link>
              ) : (
                <span className="p-1 opacity-30"><ChevronLeftIcon className="w-4 h-4" /></span>
              )}
              <span className="tabular-nums">Page {currentPage} of {totalPages}</span>
              {currentPage < totalPages ? (
                <Link href={`/sites/${siteId}?page=${currentPage + 1}`} title="Next page"
                  className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100">
                  <ChevronRightIcon className="w-4 h-4" />
                </Link>
              ) : (
                <span className="p-1 opacity-30"><ChevronRightIcon className="w-4 h-4" /></span>
              )}
            </div>
          </div>
        )}
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
