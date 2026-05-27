import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { SiteForm } from '@/components/SiteForm';

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [site, customers, projects] = await Promise.all([
    prisma.site.findUnique({ where: { id: Number(id) } }),
    prisma.customer.findMany({ orderBy: { customerName: 'asc' }, select: { id: true, customerName: true } }),
    prisma.project.findMany({  orderBy: { projectName:  'asc' }, select: { id: true, projectName:  true } }),
  ]);

  if (!site) notFound();

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/sites" className="hover:text-gray-700">Sites</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <Link href={`/sites/${site.id}`} className="hover:text-gray-700">{site.siteName}</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Edit Site</h1>

      <SiteForm
        customers={customers}
        projects={projects}
        siteId={site.id}
        initialData={{
          siteName:   site.siteName,
          customerId: site.customerId ? String(site.customerId) : '',
          projectId:  site.projectId  ? String(site.projectId)  : '',
          address:    site.address    ?? '',
          city:       site.city       ?? '',
          state:      site.state      ?? '',
          notes:      site.notes      ?? '',
        }}
      />
    </div>
  );
}
