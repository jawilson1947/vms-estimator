import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MapPinIcon, ChevronRightIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export const metadata = { title: 'Site Survey' };

interface SurveyCountRow {
  site_id: number;
  total: bigint;
  done: bigint;
}

export default async function SurveyLandingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  // Fetch sites with building counts (no new schema fields needed)
  const sites = await prisma.site.findMany({
    orderBy: { siteName: 'asc' },
    include: {
      buildings: {
        select: { id: true },
      },
    },
  });

  // Use raw SQL for surveyed counts so this works even before `prisma generate`
  // is re-run after the migration adds `surveyed_at`.
  let surveyRows: SurveyCountRow[] = [];
  try {
    surveyRows = await prisma.$queryRaw<SurveyCountRow[]>`
      SELECT
        b.site_id,
        COUNT(cl.location_id)                          AS total,
        COUNT(CASE WHEN cl.surveyed_at IS NOT NULL THEN 1 END) AS done
      FROM camera_locations cl
      JOIN buildings b ON cl.building_id = b.building_id
      GROUP BY b.site_id
    `;
  } catch {
    // Column may not exist yet if migration hasn't been run — degrade gracefully
  }

  const countBySite = new Map<number, { total: number; done: number }>();
  for (const row of surveyRows) {
    countBySite.set(Number(row.site_id), {
      total: Number(row.total),
      done:  Number(row.done),
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Site Survey</h1>
        <p className="text-sm text-gray-500 mt-0.5">Walk a site and quickly capture camera locations, photos, and notes.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map(site => {
          const counts   = countBySite.get(site.id) ?? { total: 0, done: 0 };
          const { total, done } = counts;
          const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
          const buildings = site.buildings.length;

          return (
            <Link
              key={site.id}
              href={`/survey/${site.id}`}
              className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
                  <MapPinIcon className="w-5 h-5 text-teal-600" />
                </div>
                <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>

              <div>
                <h2 className="font-semibold text-gray-900">{site.siteName}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{buildings} building{buildings !== 1 ? 's' : ''}</p>
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

      {sites.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <MapPinIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sites yet. Add a site first.</p>
        </div>
      )}
    </div>
  );
}
