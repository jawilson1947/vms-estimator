import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PlusIcon, MagnifyingGlassIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';

async function getCustomers(search: string) {
  return prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { customerName: { contains: search } },
            { contactName:  { contains: search } },
            { email:        { contains: search } },
          ],
        }
      : undefined,
    include: { _count: { select: { projects: true, sites: true } } },
    orderBy: { customerName: 'asc' },
  });
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const search    = searchParams.search ?? '';
  const customers = await getCustomers(search);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} total</p>
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
            placeholder="Search customers…"
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
        </div>
      )}
    </div>
  );
}
