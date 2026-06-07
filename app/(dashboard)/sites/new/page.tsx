import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { prisma } from '@/lib/prisma';
import { SiteForm } from '@/components/SiteForm';

export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; customerId?: string }>;
}) {
  const sp = await searchParams;
  const customers = await prisma.customer.findMany({
    orderBy: { customerName: 'asc' },
    select:  { id: true, customerName: true },
  });

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/sites" className="hover:text-gray-700">Sites</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">New Site</span>
      </nav>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Add Site</h1>
      <SiteForm
        customers={customers}
        initialData={{
          customerId: sp.customerId ?? '',
        }}
      />
    </div>
  );
}
