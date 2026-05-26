'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Customer { id: number; customerName: string; }
interface Project  { id: number; projectName:  string; }

interface SiteFormData {
  siteName:   string;
  customerId: string;
  projectId:  string;
  address:    string;
  city:       string;
  state:      string;
  notes:      string;
}

interface Props {
  customers:    Customer[];
  projects:     Project[];
  initialData?: Partial<SiteFormData>;
  siteId?:      number;
}

const empty: SiteFormData = {
  siteName: '', customerId: '', projectId: '',
  address: '', city: '', state: '', notes: '',
};

export function SiteForm({ customers, projects, initialData, siteId }: Props) {
  const router  = useRouter();
  const isEdit  = !!siteId;
  const [form, setForm]     = useState<SiteFormData>({ ...empty, ...initialData });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const url    = isEdit ? `/api/sites/${siteId}` : '/api/sites';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });

    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Something went wrong.'); return; }

    const saved = await res.json();
    router.push(`/sites/${saved.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Delete this site and all its buildings?')) return;
    await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
    router.push('/sites');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div>
        <label htmlFor="siteName" className="form-label">
          Site Name <span className="text-red-500">*</span>
        </label>
        <input
          id="siteName" name="siteName" type="text" required
          value={form.siteName} onChange={handleChange}
          className="form-input" placeholder="Acme HQ Campus"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="customerId" className="form-label">Customer</label>
          <select id="customerId" name="customerId" value={form.customerId} onChange={handleChange} className="form-select">
            <option value="">— Select customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="projectId" className="form-label">Project</label>
          <select id="projectId" name="projectId" value={form.projectId} onChange={handleChange} className="form-select">
            <option value="">— Select project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="address" className="form-label">Street Address</label>
        <input
          id="address" name="address" type="text"
          value={form.address} onChange={handleChange}
          className="form-input" placeholder="100 Main Street"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="form-label">City</label>
          <input id="city" name="city" type="text" value={form.city} onChange={handleChange} className="form-input" placeholder="Springfield" />
        </div>
        <div>
          <label htmlFor="state" className="form-label">State</label>
          <input id="state" name="state" type="text" value={form.state} onChange={handleChange} className="form-input" placeholder="IL" />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="form-label">Notes</label>
        <textarea id="notes" name="notes" rows={3} value={form.notes} onChange={handleChange} className="form-input resize-none" />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Site'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
        {isEdit && (
          <button type="button" onClick={handleDelete} className="btn-danger ml-auto">Delete Site</button>
        )}
      </div>
    </form>
  );
}
