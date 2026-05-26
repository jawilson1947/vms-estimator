import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { prisma } from '@/lib/prisma';
import { ProjectForm } from '@/components/ProjectForm';

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: { customerId?: string };
}) {
  const customers = await prisma.customer.findMany({
    orderBy: { customerName: 'asc' },
    select:  { id: true, customerName: true },
  });

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/projects" className="hover:text-gray-700">Projects</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">New Project</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Create Project</h1>

      <ProjectForm
        customers={customers}
        initialData={{ customerId: searchParams.customerId ?? '' }}
      />
    </div>
  );
}
