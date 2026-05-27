import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  ChevronRightIcon,
  PencilSquareIcon,
  FolderIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

const statusColors: Record<string, string> = {
  PROPOSED:    'bg-gray-100 text-gray-600',
  APPROVED:    'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED:   'bg-green-50 text-green-700',
  ON_HOLD:     'bg-orange-50 text-orange-700',
  CANCELLED:   'bg-red-50 text-red-700',
};

const statusLabels: Record<string, string> = {
  PROPOSED:    'Proposed',
  APPROVED:    'Approved',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  ON_HOLD:     'On Hold',
  CANCELLED:   'Cancelled',
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where:   { id: Number(id) },
    include: {
      projects: { orderBy: { projectName: 'asc' } },
      sites:    { orderBy: { siteName: 'asc' } },
    },
  });

  if (!customer) notFound();

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/customers" className="hover:text-gray-700">Customers</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{customer.customerName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{customer.customerName}</h1>
          {customer.contactName && (
            <p className="text-sm text-gray-500 mt-0.5">
              {customer.contactName}
              {customer.contactTitle && ` · ${customer.contactTitle}`}
            </p>
          )}
        </div>
        <Link href={`/customers/${customer.id}/edit`} className="btn-secondary">
          <PencilSquareIcon className="w-4 h-4" />
          Edit
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* Contact info */}
        <div className="card p-5 md:col-span-1">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h2>
          <dl className="space-y-3">
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <PhoneIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-gray-700">{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <EnvelopeIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.billingAddress && (
              <div className="flex items-start gap-2 text-sm">
                <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span className="text-gray-700 whitespace-pre-line">{customer.billingAddress}</span>
              </div>
            )}
            {customer.notes && (
              <div className="pt-2 border-t border-gray-100 text-sm text-gray-600">
                {customer.notes}
              </div>
            )}
          </dl>
        </div>

        {/* Projects */}
        <div className="card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Projects
              <span className="ml-2 badge bg-gray-100 text-gray-600">{customer.projects.length}</span>
            </h2>
            <Link href={`/projects/new?customerId=${customer.id}`} className="btn-secondary text-xs py-1 px-2.5">
              + New Project
            </Link>
          </div>

          {customer.projects.length === 0 ? (
            <p className="text-sm text-gray-400">No projects yet.</p>
          ) : (
            <div className="space-y-2">
              {customer.projects.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <FolderIcon className="w-4 h-4 text-gray-400" />
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {p.projectName}
                    </Link>
                    {p.projectNumber && (
                      <span className="text-xs text-gray-400">{p.projectNumber}</span>
                    )}
                  </div>
                  <span className={`badge text-xs ${statusColors[p.projectStatus]}`}>
                    {statusLabels[p.projectStatus]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sites */}
      {customer.sites.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Sites
            <span className="ml-2 badge bg-gray-100 text-gray-600">{customer.sites.length}</span>
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {customer.sites.map(s => (
              <Link
                key={s.id}
                href={`/sites/${s.id}`}
                className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm"
              >
                <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">{s.siteName}</p>
                  {(s.city || s.state) && (
                    <p className="text-xs text-gray-500">{[s.city, s.state].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
