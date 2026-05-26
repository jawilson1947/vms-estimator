import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { CustomerForm } from '@/components/CustomerForm';

export default function NewCustomerPage() {
  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/customers" className="hover:text-gray-700">Customers</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">New Customer</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Add Customer</h1>
      <CustomerForm />
    </div>
  );
}
