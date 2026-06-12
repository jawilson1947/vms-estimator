'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Customer { id: number; customerName: string; }

interface ProjectFormData {
  customerId:          string;
  projectName:         string;
  projectNumber:       string;
  projectType:         string;
  projectStatus:       string;
  startDate:           string;
  completionDate:      string;
  projectManager:      string;
  consultingRate:      string;
  overheadRatePercent: string;
  notes:               string;
}

interface Props {
  customers:    Customer[];
  initialData?: Partial<ProjectFormData>;
  projectId?:   number;
}

const empty: ProjectFormData = {
  customerId:          '',
  projectName:         '',
  projectNumber:       '',
  projectType:         'VIDEO_SURVEILLANCE',
  projectStatus:       'PROPOSED',
  startDate:           '',
  completionDate:      '',
  projectManager:      '',
  consultingRate:      '',
  overheadRatePercent: '',
  notes:               '',
};

const typeOptions = [
  { value: 'VIDEO_SURVEILLANCE', label: 'Video Surveillance' },
  { value: 'ACCESS_CONTROL',     label: 'Access Control'     },
];

const statusOptions = [
  { value: 'PROPOSED',    label: 'Proposed'     },
  { value: 'APPROVED',    label: 'Approved'     },
  { value: 'IN_PROGRESS', label: 'In Progress'  },
  { value: 'COMPLETED',   label: 'Completed'    },
  { value: 'ON_HOLD',     label: 'On Hold'      },
  { value: 'CANCELLED',   label: 'Cancelled'    },
];

export function ProjectForm({ customers, initialData, projectId }: Props) {
  const router  = useRouter();
  const isEdit  = !!projectId;
  const [form, setForm]     = useState<ProjectFormData>({ ...empty, ...initialData });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const url    = isEdit ? `/api/projects/${projectId}` : '/api/projects';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong.');
      return;
    }

    const saved = await res.json();
    router.push(`/projects/${saved.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Delete this project? All associated costs and sites will also be deleted.')) return;
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    router.push('/projects');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Customer */}
      <div>
        <label htmlFor="customerId" className="form-label">
          Customer <span className="text-red-500">*</span>
        </label>
        <select
          id="customerId" name="customerId"
          required value={form.customerId} onChange={handleChange}
          className="form-select"
        >
          <option value="">— Select a customer —</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.customerName}</option>
          ))}
        </select>
      </div>

      {/* Project name / number */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="projectName" className="form-label">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            id="projectName" name="projectName" type="text"
            required value={form.projectName} onChange={handleChange}
            className="form-input" placeholder="Acme HQ Surveillance Upgrade"
          />
        </div>
        <div>
          <label htmlFor="projectNumber" className="form-label">Project Number</label>
          <input
            id="projectNumber" name="projectNumber" type="text"
            value={form.projectNumber} onChange={handleChange}
            className="form-input" placeholder="PRJ-2026-001"
          />
        </div>
      </div>

      {/* Type / Status / PM */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="projectType" className="form-label">Project Type</label>
          <select
            id="projectType" name="projectType"
            value={form.projectType} onChange={handleChange}
            disabled={isEdit}
            className="form-select disabled:bg-gray-100 disabled:text-gray-500"
          >
            {typeOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {isEdit && (
            <p className="mt-1 text-xs text-gray-500">Project type is set at creation.</p>
          )}
        </div>
        <div>
          <label htmlFor="projectStatus" className="form-label">Status</label>
          <select
            id="projectStatus" name="projectStatus"
            value={form.projectStatus} onChange={handleChange}
            className="form-select"
          >
            {statusOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="projectManager" className="form-label">Project Manager</label>
          <input
            id="projectManager" name="projectManager" type="text"
            value={form.projectManager} onChange={handleChange}
            className="form-input" placeholder="Full name"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="form-label">Start Date</label>
          <input
            id="startDate" name="startDate" type="date"
            value={form.startDate} onChange={handleChange}
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="completionDate" className="form-label">Completion Date</label>
          <input
            id="completionDate" name="completionDate" type="date"
            value={form.completionDate} onChange={handleChange}
            className="form-input"
          />
        </div>
      </div>

      {/* Rates */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="consultingRate" className="form-label">Consulting Rate ($/hr)</label>
          <input
            id="consultingRate" name="consultingRate" type="number"
            min="0" step="0.01"
            value={form.consultingRate} onChange={handleChange}
            className="form-input" placeholder="125.00"
          />
        </div>
        <div>
          <label htmlFor="overheadRatePercent" className="form-label">Overhead Rate (%)</label>
          <input
            id="overheadRatePercent" name="overheadRatePercent" type="number"
            min="0" max="100" step="0.01"
            value={form.overheadRatePercent} onChange={handleChange}
            className="form-input" placeholder="15.00"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="form-label">Notes</label>
        <textarea
          id="notes" name="notes" rows={3}
          value={form.notes} onChange={handleChange}
          className="form-input resize-none" placeholder="Project scope, special requirements…"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
        {isEdit && (
          <button type="button" onClick={handleDelete} className="btn-danger ml-auto">
            Delete Project
          </button>
        )}
      </div>
    </form>
  );
}
