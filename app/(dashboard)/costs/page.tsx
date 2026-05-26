import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CurrencyDollarIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const statusColors: Record<string, string> = {
  PROPOSED: 'bg-gray-100 text-gray-600',   APPROVED:    'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700', COMPLETED: 'bg-green-50 text-green-700',
  ON_HOLD: 'bg-orange-50 text-orange-700',  CANCELLED:  'bg-red-50 text-red-600',
};
const statusLabels: Record<string, string> = {
  PROPOSED: 'Proposed', APPROVED: 'Approved', IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed', ON_HOLD: 'On Hold', CANCELLED: 'Cancelled',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

export default async function CostsPage() {
  const projects = await prisma.project.findMany({
    include: {
      customer:   { select: { customerName: true } },
      costs:      true,
      feeSummary: true,
    },
    orderBy: { projectName: 'asc' },
  });

  const totalGrand = projects.reduce(
    (sum, p) => sum + (p.feeSummary ? Number(p.feeSummary.grandTotal) : 0), 0
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cost Estimator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Select a project to manage its cost estimate.</p>
        </div>
        <div className="card px-5 py-3 text-right">
          <p className="text-xs text-gray-500">Portfolio Total</p>
          <p className="text-xl font-bold text-blue-700">{fmt(totalGrand)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {projects.map(p => {
          const directTotal = p.costs.reduce((s, c) => s + Number(c.lineTotal ?? 0), 0);
          const grandTotal  = p.feeSummary ? Number(p.feeSummary.grandTotal) : directTotal;
          const costCount   = p.costs.length;

          return (
            <Link
              key={p.id}
              href={`/costs/${p.id}`}
              className="card p-5 flex items-center gap-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <CurrencyDollarIcon className="w-5 h-5 text-blue-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                    {p.projectName}
                  </span>
                  <span className={`badge text-xs ${statusColors[p.projectStatus]}`}>
                    {statusLabels[p.projectStatus]}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {p.customer.customerName}
                  {p.projectNumber && <span className="ml-2 text-gray-400">{p.projectNumber}</span>}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6 text-right shrink-0">
                <div>
                  <p className="text-xs text-gray-400">Line Items</p>
                  <p className="font-semibold text-gray-700">{costCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Direct Costs</p>
                  <p className="font-semibold text-gray-700">{fmt(directTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Grand Total</p>
                  <p className="font-bold text-blue-700 text-lg">{fmt(grandTotal)}</p>
                </div>
              </div>

              <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
