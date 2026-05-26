import { prisma } from '@/lib/prisma';
import { CameraModelManager } from '@/components/CameraModelManager';

export default async function CameraModelsPage() {
  const models = await prisma.cameraModel.findMany({
    include: { _count: { select: { cameras: true } } },
    orderBy: [{ manufacturer: 'asc' }, { modelNumber: 'asc' }],
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Camera Models</h1>
        <p className="text-sm text-gray-500 mt-0.5">Shared catalog of camera specifications used across all projects.</p>
      </div>
      <CameraModelManager initialModels={models} />
    </div>
  );
}
