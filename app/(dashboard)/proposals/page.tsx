import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { DocumentPlusIcon, ArrowDownTrayIcon, FolderIcon } from '@heroicons/react/24/outline';
import { ProposalsDownloadButton } from '@/components/ProposalsDownloadButton';

const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-600',
};

export default async function ProposalsPage() {
  const proposals = await prisma.proposal.findMany({
    where:   { project: { id: { gt: 0 } } },
    orderBy: { createdAt: 'desc' },
    include: { project: { include: { customer: { select: { customerName: true } } } } },
  });

  const counts = {
    total:    proposals.length,
    draft:    proposals.filter(p => p.status === 'draft').length,
    sent:     proposals.filter(p => p.status === 'sent').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    rejected: proposals.filter(p => p.status === 'rejected').length,
  };

  const winRate = counts.accepted + counts.rejected > 0
    ? Math.round((counts.accepted / (counts.accepted + counts.rejected)) * 100)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proposals</h1>
          <p className="text-sm text-gray-500 mt-0.5">All AI-generated project proposals across your portfolio.</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total',    value: counts.total,    color: 'text-gray-900' },
          { label: 'Draft',    value: counts.draft,    color: 'text-gray-600' },
          { label: 'Sent',     value: counts.sent,     color: 'text-blue-700' },
          { label: 'Accepted', value: counts.accepted, color: 'text-green-700' },
          { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—', color: winRate !== null && winRate >= 50 ? 'text-green-700' : 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {proposals.length === 0 ? (
        <div className="card p-12 text-center">
          <DocumentPlusIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No proposals yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Open a project and click <strong>Prepare Proposal</strong> to get started.
          </p>
          <Link href="/projects" className="btn-primary mt-4 inline-flex">Browse Projects</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Tone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Valid Until</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Created</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {proposals.map(p => {
                const expired = p.validUntil && new Date(p.validUntil) < new Date();
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">
                      {p.title}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${p.projectId}`}
                        className="flex items-center gap-1.5 text-blue-600 hover:underline"
                      >
                        <FolderIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[120px]">{p.project.projectName}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">
                      {p.project.customer.customerName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{p.tone}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs capitalize ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.status}
                      </span>
                      {expired && p.status === 'draft' && (
                        <span className="ml-1 badge text-xs bg-orange-50 text-orange-600">Expired</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.validUntil
                        ? new Date(p.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <ProposalsDownloadButton
                        projectId={p.projectId}
                        proposalId={p.id}
                        projectName={p.project.projectName}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
