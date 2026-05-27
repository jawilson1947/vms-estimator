import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  ChevronRightIcon, PencilSquareIcon, CameraIcon,
  WifiIcon, ServerStackIcon, WrenchScrewdriverIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { CameraImageGallery } from '@/components/CameraImageGallery';
import { MaintenanceLog } from '@/components/MaintenanceLog';

const statusColors: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-600', INSTALLED: 'bg-blue-50 text-blue-700',
  ACTIVE: 'bg-green-50 text-green-700',  OFFLINE: 'bg-red-50 text-red-600',
  NEEDS_REPAIR: 'bg-amber-50 text-amber-700', RETIRED: 'bg-gray-100 text-gray-400',
};
const statusLabels: Record<string, string> = {
  PLANNED: 'Planned', INSTALLED: 'Installed', ACTIVE: 'Active',
  OFFLINE: 'Offline', NEEDS_REPAIR: 'Needs Repair', RETIRED: 'Retired',
};

export default async function CameraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camera = await prisma.camera.findUnique({
    where:   { id: Number(id) },
    include: {
      model: true,
      location: { include: { building: { include: { site: true } } } },
      maintenanceRecords: { orderBy: { serviceDate: 'desc' } },
      images:             { orderBy: { uploadedAt: 'desc' } },
    },
  });

  if (!camera) notFound();

  const loc = camera.location;

  function Row({ label, value }: { label: string; value?: string | number | null }) {
    return (
      <div className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
        <dt className="text-gray-500">{label}</dt>
        <dd className="font-medium text-gray-900 text-right">{value ?? '—'}</dd>
      </div>
    );
  }

  // Serialise images for client component (BigInt → number)
  const serialisedImages = camera.images.map(img => ({
    ...img,
    fileSizeBytes: img.fileSizeBytes ? Number(img.fileSizeBytes) : null,
    uploadedAt:    img.uploadedAt.toISOString(),
  }));

  // Serialise maintenance records for client component
  const serialisedMaintenance = camera.maintenanceRecords.map(r => ({
    ...r,
    serviceDate:   r.serviceDate.toISOString(),
    nextServiceDue: r.nextServiceDue ? r.nextServiceDue.toISOString() : null,
  }));

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/cameras" className="hover:text-gray-700">Cameras</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="font-mono text-gray-700">{camera.cameraCode}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{camera.cameraName}</h1>
            <span className={`badge ${statusColors[camera.status]}`}>{statusLabels[camera.status]}</span>
          </div>
          <p className="text-sm text-gray-500 font-mono mt-0.5">{camera.cameraCode}</p>
          {loc && (
            <p className="text-sm text-gray-500 mt-0.5">
              {loc.building.site.siteName} › {loc.building.buildingName}
              {loc.areaName && ` › ${loc.areaName}`}
              {loc.floor && ` (Floor ${loc.floor})`}
            </p>
          )}
        </div>
        <Link href={`/cameras/${camera.id}/edit`} className="btn-secondary">
          <PencilSquareIcon className="w-4 h-4" /> Edit
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Camera / Model */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <CameraIcon className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900">Camera & Model</h2>
          </div>
          <dl>
            <Row label="Model"         value={camera.model ? `${camera.model.manufacturer ?? ''} ${camera.model.modelNumber ?? ''}`.trim() : null} />
            <Row label="Type"          value={camera.model?.cameraType} />
            <Row label="Resolution"    value={camera.model?.resolution} />
            <Row label="Lens"          value={camera.model?.lensType} />
            <Row label="Field of View" value={camera.model?.fieldOfView} />
            <Row label="IR Distance"   value={camera.model?.irDistance} />
            <Row label="Serial Number" value={camera.serialNumber} />
            <Row label="Asset Tag"     value={camera.assetTag} />
            <Row label="Firmware"      value={camera.firmwareVersion} />
            <Row label="Install Date"  value={camera.installDate        ? new Date(camera.installDate).toLocaleDateString()        : null} />
            <Row label="Warranty Exp." value={camera.warrantyExpiration ? new Date(camera.warrantyExpiration).toLocaleDateString() : null} />
          </dl>
        </div>

        {/* Network */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <WifiIcon className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900">Network</h2>
          </div>
          <dl>
            <Row label="IP Address"   value={camera.ipAddress} />
            <Row label="MAC Address"  value={camera.macAddress} />
            <Row label="VLAN"         value={camera.vlanId} />
            <Row label="Switch"       value={camera.switchName} />
            <Row label="Switch Port"  value={camera.switchPort} />
            <Row label="NVR"          value={camera.nvrName} />
            <Row label="PoE Standard" value={camera.model?.poeStandard} />
            <Row label="Max Watts"    value={camera.model?.maxPowerWatts ? `${camera.model.maxPowerWatts}W` : null} />
          </dl>
        </div>

        {/* Recording */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ServerStackIcon className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-900">Recording</h2>
          </div>
          <dl>
            <Row label="Recording Mode" value={camera.recordingMode} />
            <Row label="Retention"      value={camera.retentionDays ? `${camera.retentionDays} days` : null} />
            <Row label="Bitrate"        value={camera.bitrateMbps   ? `${camera.bitrateMbps} Mbps`   : null} />
            <Row label="Frame Rate"     value={camera.frameRate     ? `${camera.frameRate} fps`      : null} />
            <Row label="Codec"          value={camera.model?.codecSupport} />
          </dl>
        </div>

        {/* Security */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-900">Security Compliance</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Username Changed', ok: camera.usernameChanged },
              { label: 'HTTPS Enabled',    ok: camera.httpsEnabled },
              { label: 'Privacy Mask',     ok: camera.privacyMaskEnabled },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600">{label}</span>
                <span className={`badge ${ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {ok ? '✓ Yes' : '✗ No'}
                </span>
              </div>
            ))}
          </div>
          {camera.notes && (
            <p className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-600">{camera.notes}</p>
          )}
        </div>
      </div>

      {/* Image gallery */}
      <div className="card p-5 mb-4">
        <CameraImageGallery
          cameraId={camera.id}
          initialImages={serialisedImages as any}
        />
      </div>

      {/* Maintenance log */}
      <div className="card p-5">
        <MaintenanceLog
          cameraId={camera.id}
          initialRecords={serialisedMaintenance as any}
        />
      </div>
    </div>
  );
}
