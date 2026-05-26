import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { CustomerForm } from '@/components/CustomerForm';

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(params.id) },
  });

  if (!customer) notFound();

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/customers" className="hover:text-gray-700">Customers</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <Link href={`/customers/${customer.id}`} className="hover:text-gray-700">
          {customer.customerName}
        </Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Edit Customer</h1>

      <CustomerForm
        customerId={customer.id}
        initialData={{
          customerName:   customer.customerName,
          contactName:    customer.contactName  ?? '',
          contactTitle:   customer.contactTitle ?? '',
          phone:          customer.phone          ?? '',
          email:          customer.email          ?? '',
          billingAddress: customer.billingAddress ?? '',
          notes:          customer.notes          ?? '',
        }}
      />
    </div>
  );
}
