import { WifiIcon } from '@heroicons/react/24/outline';

export default function NetworkPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Network</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Network / PoE planning was based on camera instances, which have been removed.
        </p>
      </div>
      <div className="card p-12 text-center">
        <WifiIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          Network planning will be redesigned for the new camera catalog system.
        </p>
      </div>
    </div>
  );
}
