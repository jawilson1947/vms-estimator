import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { InternetCheck } from '@/components/settings/InternetCheck';

export default function ConnectivityPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/settings" className="hover:text-gray-700">Settings</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Internet & Connectivity</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Internet & Connectivity</h1>
        <Link href="/settings" className="btn-secondary text-sm">
          ← Back to Settings
        </Link>
      </div>

      <div className="card p-6">
        <InternetCheck />
      </div>
    </div>
  );
}
