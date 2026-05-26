import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { prisma } from '@/lib/prisma';
import { CameraForm } from '@/components/CameraForm';

async function getFormData() {
  const [models, locations] = await Promise.all([
    prisma.cameraModel.findMany({
      orderBy: [{ manufacturer: 'asc' }, { modelNumber: 'asc' }],
      select:  { id: true, manufacturer: true, modelNumber: true },
    }),
    prisma.cameraLocation.findMany({
      orderBy: { areaName: 'asc' },
      select: {
        id: true, areaName: true, floor: true,
        building: { select: { buildingName: true, site: { select: { siteName: true } } } },
      },
    }),
  ]);
  return { models, locations };
}

export default async function NewCameraPage() {
  const { models, locations } = await getFormData();

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/cameras" className="hover:text-gray-700">Cameras</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">New Camera</span>
      </nav>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Add Camera</h1>
      <CameraForm models={models} locations={locations} />
    </div>
  );
}
