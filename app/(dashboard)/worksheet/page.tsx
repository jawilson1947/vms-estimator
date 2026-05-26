import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { DocumentTextIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export default async function WorksheetIndexPage() {
  const sites = await prisma.site.findMany({
    include: {
      customer: { select: { customerName: true } },
      buildings: {
        include: {
          locations: {
            include: {
              cameras: {
                where: { status: { not: 'RETIRED' } },
                include: { model: true },
              },
            },
          },
        },
      },
    },
    orderBy: { siteName: 'asc' },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Design Worksheet</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Select a site to view the surveillance design summary and storage estimates.
        </p>
      </div>

      <div className="space-y-3">
        {sites.map(site => {
          const cameras = site.buildings.flatMap(b => b.locations.flatMap(l => l.cameras));
          const cameraCount = cameras.length;
          return (
            <Link
              key={site.id}
              href={`/worksheet/${site.id}`}
              className="card p-5 flex items-center gap-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                <DocumentTextIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                  {site.siteName}
                </p>
                <p className="text-sm text-gray-500">{site.customer?.customerName ?? '—'}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                {cameraCount} camera{cameraCount !== 1 ? 's' : ''}
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 transition-colors" />
            </Link>
          );
        })}
        {sites.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <DocumentTextIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No sites found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
