import { ArtifactCatalogManager } from '@/components/settings/ArtifactCatalogManager';

export default function ArtifactsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Artifacts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Access control equipment catalog</p>
      </div>
      <div className="card p-6">
        <ArtifactCatalogManager />
      </div>
    </div>
  );
}
