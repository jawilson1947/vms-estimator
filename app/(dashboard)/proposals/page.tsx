import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  DocumentPlusIcon, FolderIcon, MagnifyingGlassIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { ProposalsDownloadButton } from '@/components/ProposalsDownloadButton';

const PAGE_SIZE = 8;

const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-600',
};

function proposalWhere(search: string) {
  return {
    // Excludes orphaned proposals whose project row no longer exists
    project: { id: { gt: 0 } },
    ...(search
      ? {
          OR: [
            { title:  { contains: search } },
            { status: { contains: search } },
            { tone:   { contains: search } },
            { project: { projectName: { contains: search } } },
            { project: { customer: { customerName: { contains: search } } } },
          ],
        }
      : {}),
  };
}

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? '';
  const where  = proposalWhere(search);

  // Portfolio-wide KPIs (independent of search/page)
  const statusGroups = await prisma.proposal.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { project: { id: { gt: 0 } } },
  });
  const byStatus = Object.fromEntries(statusGroups.map(g => [g.status, g._count._all]));
  const counts = {
    total:    statusGroups.reduce((s, g) => s + g._count._all, 0),
    draft:    byStatus['draft']    ?? 0,
    sent:     byStatus['sent']     ?? 0,
    accepted: byStatus['accepted'] ?? 0,
    rejected: byStatus['rejected'] ?? 0,
  };

  const winRate = counts.accepted + counts.rejected > 0
    ? Math.round((counts.accepted / (counts.accepted + counts.rejected)) * 100)
    : null;

  const total       = await prisma.proposal.count({ where });
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(params.page) || 1), totalPages);

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { project: { include: { customer: { select: { customerName: true } } } } },
    skip:    (currentPage - 1) * PAGE_SIZE,
    take:    PAGE_SIZE,
  });

  const pageHref = (p: number) =>
    `/proposals?${new URLSearchParams({ ...(search ? { search } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

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

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <form>
          <input
            name="search"
            defaultValue={search}
            placeholder="Search title, project, customer, status…"
            className="form-input pl-9 w-full"
          />
        </form>
      </div>

      {proposals.length === 0 ? (
        <div className="card p-12 text-center">
          <DocumentPlusIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {search ? 'No proposals match your search.' : 'No proposals yet.'}
          </p>
          {!search && (
            <>
              <p className="text-xs text-gray-400 mt-1">
                Open a project and click <strong>Prepare Proposal</strong> to get started.
              </p>
              <Link href="/projects" className="btn-primary mt-4 inline-flex">Browse Projects</Link>
            </>
          )}
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link href={pageHref(currentPage - 1)} title="Previous page"
                    className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100">
                    <ChevronLeftIcon className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="p-1 opacity-30"><ChevronLeftIcon className="w-4 h-4" /></span>
                )}
                <span className="tabular-nums">Page {currentPage} of {totalPages}</span>
                {currentPage < totalPages ? (
                  <Link href={pageHref(currentPage + 1)} title="Next page"
                    className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100">
                    <ChevronRightIcon className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="p-1 opacity-30"><ChevronRightIcon className="w-4 h-4" /></span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
