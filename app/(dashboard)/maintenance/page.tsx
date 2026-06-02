import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

export const metadata = { title: 'Maintenance' };

export default function MaintenancePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Maintenance</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Maintenance records were tied to camera instances, which have been removed.
        </p>
      </div>
      <div className="card p-12 text-center">
        <WrenchScrewdriverIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          Maintenance tracking will be redesigned for the new camera catalog system.
        </p>
      </div>
    </div>
  );
}
