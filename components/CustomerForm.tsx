'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CustomerFormData {
  customerName:   string;
  contactName:    string;
  contactTitle:   string;
  phone:          string;
  email:          string;
  billingAddress: string;
  notes:          string;
}

interface Props {
  initialData?: Partial<CustomerFormData>;
  customerId?:  number;
}

const empty: CustomerFormData = {
  customerName:   '',
  contactName:    '',
  contactTitle:   '',
  phone:          '',
  email:          '',
  billingAddress: '',
  notes:          '',
};

export function CustomerForm({ initialData, customerId }: Props) {
  const router  = useRouter();
  const isEdit  = !!customerId;
  const [form, setForm]     = useState<CustomerFormData>({ ...empty, ...initialData });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const url    = isEdit ? `/api/customers/${customerId}` : '/api/customers';
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
    router.push(`/customers/${saved.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
    router.push('/customers');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Customer name */}
      <div>
        <label htmlFor="customerName" className="form-label">
          Customer Name <span className="text-red-500">*</span>
        </label>
        <input
          id="customerName" name="customerName" type="text"
          required value={form.customerName} onChange={handleChange}
          className="form-input" placeholder="Acme Corporation"
        />
      </div>

      {/* Contact */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contactName" className="form-label">Contact Name</label>
          <input
            id="contactName" name="contactName" type="text"
            value={form.contactName} onChange={handleChange}
            className="form-input" placeholder="Jane Smith"
          />
        </div>
        <div>
          <label htmlFor="contactTitle" className="form-label">Contact Title</label>
          <input
            id="contactTitle" name="contactTitle" type="text"
            value={form.contactTitle} onChange={handleChange}
            className="form-input" placeholder="Facilities Director"
          />
        </div>
      </div>

      {/* Phone / Email */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="phone" className="form-label">Phone</label>
          <input
            id="phone" name="phone" type="tel"
            value={form.phone} onChange={handleChange}
            className="form-input" placeholder="555-100-2000"
          />
        </div>
        <div>
          <label htmlFor="email" className="form-label">Email</label>
          <input
            id="email" name="email" type="email"
            value={form.email} onChange={handleChange}
            className="form-input" placeholder="contact@company.com"
          />
        </div>
      </div>

      {/* Billing address */}
      <div>
        <label htmlFor="billingAddress" className="form-label">Billing Address</label>
        <textarea
          id="billingAddress" name="billingAddress" rows={2}
          value={form.billingAddress} onChange={handleChange}
          className="form-input resize-none" placeholder="123 Main St, City, State ZIP"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="form-label">Notes</label>
        <textarea
          id="notes" name="notes" rows={3}
          value={form.notes} onChange={handleChange}
          className="form-input resize-none" placeholder="Additional notes…"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
        {isEdit && (
          <button type="button" onClick={handleDelete} className="btn-danger ml-auto">
            Delete Customer
          </button>
        )}
      </div>
    </form>
  );
}
