import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MapPinIcon, ChevronRightIcon, CheckCircleIcon, ClockIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export const metadata = { title: 'Site Survey' };

export default async function SurveyLandingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  // Fetch projects that have a building assigned, with location counts
  const projects = await prisma.project.findMany({
    where:   { buildingId: { not: null } },
    orderBy: { projectName: 'asc' },
    select: {
      id:          true,
      projectName: true,
      projectType: true,
      building: { select: { id: true, buildingName: true, site: { select: { siteName: true } } } },
      _count:  { select: { cameraLocations: true } },
    },
  });

  // Surveyed count per project (locations where surveyedAt is not null)
  const surveyedCounts = await prisma.cameraLocation.groupBy({
    by:     ['projectId'],
    where:  { projectId: { not: null }, surveyedAt: { not: null } },
    _count: { id: true },
  });
  const surveyedByProject = new Map<number, number>();
  for (const row of surveyedCounts) {
    if (row.projectId != null) surveyedByProject.set(row.projectId, row._count.id);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Site Survey</h1>
        <p className="text-sm text-gray-500 mt-0.5">Walk a project site and capture camera locations, photos, and notes.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => {
          const total = project._count.cameraLocations;
          const done  = surveyedByProject.get(project.id) ?? 0;
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
          const isAC  = project.projectType === 'ACCESS_CONTROL';

          return (
            <Link
              key={project.id}
              href={`/survey/${project.id}`}
              className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isAC ? 'bg-fuchsia-50' : 'bg-teal-50'}`}>
                  {isAC
                    ? <LockClosedIcon className="w-5 h-5 text-fuchsia-600" />
                    : <MapPinIcon className="w-5 h-5 text-teal-600" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isAC ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-teal-100 text-teal-700'}`}>
                    {isAC ? 'Access Control' : 'Video'}
                  </span>
                  <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </div>

              <div>
                <h2 className="font-semibold text-gray-900">{project.projectName}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {project.building?.buildingName ?? '—'}
                  {project.building?.site?.siteName && <> · {project.building.site.siteName}</>}
                </p>
              </div>

              {total > 0 ? (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">{done}/{total} locations</span>
                    <span className={pct === 100 ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No locations yet — tap to start surveying</p>
              )}

              <div className="flex items-center gap-1 pt-1">
                {pct === 100 && total > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <ClockIcon className="w-3.5 h-3.5" />
                    In progress
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <MapPinIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No projects with buildings yet. Assign a building to a project first.</p>
        </div>
      )}
    </div>
  );
}
