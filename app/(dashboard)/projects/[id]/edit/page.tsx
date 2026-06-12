import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { ProjectForm } from '@/components/ProjectForm';

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, customers] = await Promise.all([
    prisma.project.findUnique({ where: { id: Number(id) } }),
    prisma.customer.findMany({ orderBy: { customerName: 'asc' }, select: { id: true, customerName: true } }),
  ]);

  if (!project) notFound();

  function fmt(d: Date | null) {
    return d ? d.toISOString().split('T')[0] : '';
  }

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/projects" className="hover:text-gray-700">Projects</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <Link href={`/projects/${project.id}`} className="hover:text-gray-700">{project.projectName}</Link>
        <ChevronRightIcon className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Edit Project</h1>

      <ProjectForm
        customers={customers}
        projectId={project.id}
        initialData={{
          customerId:          String(project.customerId),
          projectName:         project.projectName,
          projectNumber:       project.projectNumber       ?? '',
          projectType:         project.projectType,
          projectStatus:       project.projectStatus,
          startDate:           fmt(project.startDate),
          completionDate:      fmt(project.completionDate),
          projectManager:      project.projectManager      ?? '',
          consultingRate:      project.consultingRate      ? String(project.consultingRate)      : '',
          overheadRatePercent: project.overheadRatePercent ? String(project.overheadRatePercent) : '',
          notes
:               project.notes               ?? '',
        }}
      />
    </div>
  );
}
