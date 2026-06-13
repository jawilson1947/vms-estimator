import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  PlusIcon, MagnifyingGlassIcon, BuildingOffice2Icon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 10;

function customerWhere(search: string) {
  return search
    ? {
        OR: [
          { customerName: { contains: search } },
          { contactName:  { contains: search } },
          { contactTitle: { contains: search } },
          { email:        { contains: search } },
          { phone:        { contains: search } },
        ],
      }
    : undefined;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? '';
  const where  = customerWhere(search);

  const total       = await prisma.customer.count({ where });
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(params.page) || 1), totalPages);

  const customers = await prisma.customer.findMany({
    where,
    include: { _count: { select: { projects: true, sites: true } } },
    orderBy: { customerName: 'asc' },
    skip:    (currentPage - 1) * PAGE_SIZE,
    take:    PAGE_SIZE,
  });

  const pageHref = (p: number) =>
    `/customers?${new URLSearchParams({ ...(search ? { search } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <Link href="/customers/new" className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          Add Customer
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <form>
          <input
            name="search"
            defaultValue={search}
            placeholder="Search name, contact, email, phone…"
            className="form-input pl-9 w-full"
          />
        </form>
      </div>

      {/* Table */}
      {customers.length === 0 ? (
        <div className="card p-12 text-center">
          <BuildingOffice2Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {search ? 'No customers match your search.' : 'No customers yet.'}
          </p>
          {!search && (
            <Link href="/customers/new" className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-4 h-4" /> Add your first customer
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Projects</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Sites</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {c.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.contactName ?? '—'}
                    {c.contactTitle && (
                      <span className="text-gray-400 text-xs ml-1">· {c.contactTitle}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="badge bg-blue-50 text-blue-700">{c._count.projects}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="badge bg-gray-100 text-gray-600">{c._count.sites}</span>
                  </td>
                </tr>
              ))}
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
