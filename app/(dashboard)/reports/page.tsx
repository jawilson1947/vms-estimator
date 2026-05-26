import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  TableCellsIcon, CurrencyDollarIcon, DocumentTextIcon,
  ArrowDownTrayIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import { SiteSurveyLinks } from '@/components/SiteSurveyLinks';

export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const [cameraCount, projectCount, siteCount, sites] = await Promise.all([
    prisma.camera.count(),
    prisma.project.count(),
    prisma.site.count(),
    prisma.site.findMany({
      select: { id: true, siteName: true },
      orderBy: { siteName: 'asc' },
    }),
  ]);

  const excelReports = [
    {
      icon: TableCellsIcon,
      color: 'text-blue-600',
      bg:    'bg-blue-50',
      title: 'Camera Inventory',
      description: 'Full camera list with specs, network, recording, and compliance data. Includes summary and per-site tabs.',
      href:  '/api/reports/cameras.xlsx',
      label: 'Download Excel',
      meta:  `${cameraCount} cameras`,
      ext:   'XLSX',
    },
    {
      icon: CurrencyDollarIcon,
      color: 'text-green-600',
      bg:    'bg-green-50',
      title: 'Cost Breakdown',
      description: 'All project cost line items with fee summaries and a portfolio-level summary tab.',
      href:  '/api/reports/costs.xlsx',
      label: 'Download Excel',
      meta:  `${projectCount} projects`,
      ext:   'XLSX',
    },
    {
      icon: DocumentTextIcon,
      color: 'text-indigo-600',
      bg:    'bg-indigo-50',
      title: 'Design Worksheet',
      description: 'Per-site camera coverage worksheet with storage estimates, PoE totals, and compliance status.',
      href:  '/worksheet',
      label: 'View Worksheet',
      meta:  `${siteCount} sites`,
      ext:   'WEB',
      internal: true,
    },
  ] satisfies Array<{
    icon: React.ComponentType<{ className?: string }>;
    color: string; bg: string; title: string; description: string;
    href: string; label: string; meta: string; ext: string;
    internal?: boolean;
  }>;

  const pdfReports = [
    {
      icon: ChartBarIcon,
      color: 'text-violet-600',
      bg:    'bg-violet-50',
      title: 'Profitability Summary',
      description: 'Per-project revenue, direct cost, and margin analysis across the entire portfolio.',
      href:  '/api/reports/profitability.pdf',
      label: 'Download PDF',
      meta:  `${projectCount} projects`,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Export data and generate reports for your surveillance system.</p>
      </div>

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Spreadsheets &amp; Views</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {excelReports.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.title} className="card p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${r.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${r.color}`} />
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  r.ext === 'XLSX' ? 'bg-green-50 text-green-700' :
                  r.ext === 'WEB'  ? 'bg-gray-100 text-gray-600' :
                                     'bg-blue-50 text-blue-700'
                }`}>{r.ext}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{r.title}</h3>
                <p className="text-sm text-gray-500">{r.description}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">{r.meta}</span>
                {r.internal ? (
                  <Link href={r.href} className="btn-secondary text-xs flex items-center gap-1.5">
                    <DocumentTextIcon className="w-3.5 h-3.5" />
                    {r.label}
                  </Link>
                ) : (
                  <a href={r.href} download className="btn-primary text-xs flex items-center gap-1.5">
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    {r.label}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">PDF Reports</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {pdfReports.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.title} className="card p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${r.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${r.color}`} />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700">PDF</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{r.title}</h3>
                <p className="text-sm text-gray-500">{r.description}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">{r.meta}</span>
                <a href={r.href} download className="btn-primary text-xs flex items-center gap-1.5">
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  {r.label}
                </a>
              </div>
            </div>
          );
        })}
        <SiteSurveyLinks sites={sites} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Exports</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <a href="/api/reports/cameras.xlsx" download className="flex items-center gap-1.5 text-blue-600 hover:underline">
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            Camera Inventory (.xlsx)
          </a>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <a href="/api/reports/costs.xlsx" download className="flex items-center gap-1.5 text-blue-600 hover:underline">
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            Cost Breakdown (.xlsx)
          </a>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <a href="/api/reports/profitability.pdf" download className="flex items-center gap-1.5 text-blue-600 hover:underline">
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            Profitability (.pdf)
          </a>
        </div>
      </div>
    </div>
  );
}
