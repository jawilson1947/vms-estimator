'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  WrenchScrewdriverIcon, PlusIcon, PencilIcon, TrashIcon,
  CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';

interface MaintenanceRecord {
  id: number;
  cameraId: number;
  serviceDate: string;
  serviceType: string | null;
  technician: string | null;
  issueFound: string | null;
  correctiveAction: string | null;
  nextServiceDue: string | null;
}

interface Props {
  cameraId: number;
  initialRecords: MaintenanceRecord[];
}

const EMPTY_FORM = {
  serviceDate: format(new Date(), 'yyyy-MM-dd'),
  serviceType: '',
  technician: '',
  issueFound: '',
  correctiveAction: '',
  nextServiceDue: '',
};

function dueBadge(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  if (isPast(d)) return <span className="badge bg-red-50 text-red-700">Overdue</span>;
  if (isWithinInterval(d, { start: now, end: addDays(now, 30) })) {
    return <span className="badge bg-amber-50 text-amber-700">Due soon</span>;
  }
  return <span className="badge bg-green-50 text-green-700">Scheduled</span>;
}

export function MaintenanceLog({ cameraId, initialRecords }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<MaintenanceRecord[]>(initialRecords);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (r: MaintenanceRecord) => {
    setEditing(r.id);
    setForm({
      serviceDate:      r.serviceDate.split('T')[0],
      serviceType:      r.serviceType      ?? '',
      technician:       r.technician       ?? '',
      issueFound:       r.issueFound       ?? '',
      correctiveAction: r.correctiveAction ?? '',
      nextServiceDue:   r.nextServiceDue   ? r.nextServiceDue.split('T')[0] : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      serviceDate:      form.serviceDate,
      serviceType:      form.serviceType      || null,
      technician:       form.technician       || null,
      issueFound:       form.issueFound       || null,
      correctiveAction: form.correctiveAction || null,
      nextServiceDue:   form.nextServiceDue   || null,
    };

    try {
      let res: Response;
      if (editing !== null) {
        res = await fetch(`/api/maintenance/${editing}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/cameras/${cameraId}/maintenance`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const record: MaintenanceRecord = await res.json();
        if (editing !== null) {
          setRecords(prev => prev.map(r => r.id === editing ? record : r));
        } else {
          setRecords(prev => [record, ...prev]);
        }
        setShowForm(false);
        setEditing(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRecords(prev => prev.filter(r => r.id !== id));
      setDeleteConfirm(null);
    }
  };

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <WrenchScrewdriverIcon className="w-4 h-4" />
          Maintenance Log
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {records.length}
          </span>
        </h3>
        <button onClick={openAdd} className="btn-primary text-xs flex items-center gap-1.5">
          <PlusIcon className="w-3.5 h-3.5" />
          Add Record
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50/30">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">
            {editing !== null ? 'Edit Maintenance Record' : 'New Maintenance Record'}
          </h4>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service Date *</label>
              <input type="date" value={form.serviceDate} onChange={set('serviceDate')} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Next Service Due</label>
              <input type="date" value={form.nextServiceDue} onChange={set('nextServiceDue')} className="input-field text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service Type</label>
              <input type="text" value={form.serviceType} onChange={set('serviceType')}
                placeholder="e.g. Cleaning, Firmware Update…" className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Technician</label>
              <input type="text" value={form.technician} onChange={set('technician')}
                placeholder="Technician name" className="input-field text-sm" />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Issue Found</label>
            <textarea value={form.issueFound} onChange={set('issueFound')} rows={2}
              placeholder="Describe any issues found…" className="input-field text-sm resize-none" />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Corrective Action</label>
            <textarea value={form.correctiveAction} onChange={set('correctiveAction')} rows={2}
              placeholder="Actions taken to resolve issues…" className="input-field text-sm resize-none" />
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.serviceDate || saving}
              className="btn-primary text-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save Record'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {records.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <WrenchScrewdriverIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No maintenance records yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 font-medium py-2 pr-4">Service Date</th>
                <th className="text-left text-xs text-gray-400 font-medium py-2 pr-4">Type</th>
                <th className="text-left text-xs text-gray-400 font-medium py-2 pr-4">Technician</th>
                <th className="text-left text-xs text-gray-400 font-medium py-2 pr-4">Issue Found</th>
                <th className="text-left text-xs text-gray-400 font-medium py-2 pr-4">Next Due</th>
                <th className="py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 group">
                  <td className="py-3 pr-4 font-medium text-gray-900 whitespace-nowrap">
                    {format(new Date(r.serviceDate), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{r.serviceType ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-600">{r.technician ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-500 max-w-xs">
                    <span className="line-clamp-2">{r.issueFound ?? '—'}</span>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {r.nextServiceDue ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-700">{format(new Date(r.nextServiceDue), 'MMM d, yyyy')}</span>
                        {dueBadge(r.nextServiceDue)}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(r)}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(r.id)}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 mb-2">Delete maintenance record?</h3>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
