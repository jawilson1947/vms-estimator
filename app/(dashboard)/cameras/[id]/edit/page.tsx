import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { CameraForm } from '@/components/CameraForm';

export default async function EditCameraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [camera, models, locations] = await Promise.all([
    prisma.camera.findUnique({ where: { id: Number(id) } }),
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

  if (!camera) notFound();

  function fmt(d: Date | null) { return d ? d.toISOString().split('T')[0] : ''; }

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/cameras" className="hover:text-gray-700">Cameras</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <Link href={`/cameras/${camera.id}`} className="font-mono hover:text-gray-700">{camera.cameraCode}</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Edit Camera</h1>

      <CameraForm
        models={models}
        locations={locations}
        cameraId={camera.id}
        initialData={{
          cameraCode:         camera.cameraCode,
          cameraName:         camera.cameraName,
          modelId:            camera.modelId    ? String(camera.modelId)    : '',
          locationId:         camera.locationId ? String(camera.locationId) : '',
          status:             camera.status,
          serialNumber:       camera.serialNumber    ?? '',
          assetTag:           camera.assetTag         ?? '',
          firmwareVersion:    camera.firmwareVersion  ?? '',
          installDate:        fmt(camera.installDate),
          warrantyExpiration: fmt(camera.warrantyExpiration),
          ipAddress:          camera.ipAddress  ?? '',
          macAddress:         camera.macAddress ?? '',
          vlanId:             camera.vlanId     ? String(camera.vlanId)   : '',
          switchName:         camera.switchName ?? '',
          switchPort:         camera.switchPort ?? '',
          nvrName:            camera.nvrName    ?? '',
          recordingMode:      camera.recordingMode ?? '',
          retentionDays:      camera.retentionDays ? String(camera.retentionDays) : '',
          bitrateMbps:        camera.bitrateMbps   ? String(camera.bitrateMbps)   : '',
          frameRate:          camera.frameRate     ? String(camera.frameRate)     : '',
          usernameChanged:    camera.usernameChanged,
          httpsEnabled:       camera.httpsEnabled,
          privacyMaskEnabled: camera.privacyMaskEnabled,
          notes:              camera.notes ?? '',
        }}
      />
    </div>
  );
}
