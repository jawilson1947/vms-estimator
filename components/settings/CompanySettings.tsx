'use client';

import { useState, useEffect, useRef } from 'react';
import { BuildingOffice2Icon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface CompanyProfile {
  companyName:           string;
  companyTagline:        string;
  logoUrl:               string;
  companyPhone:          string;
  companyAddress:        string;
  companyWebsite:        string;
  defaultProjectManager: string;
}

const EMPTY: CompanyProfile = {
  companyName: '', companyTagline: '', logoUrl: '',
  companyPhone: '', companyAddress: '', companyWebsite: '',
  defaultProjectManager: '',
};

export function CompanySettings() {
  const [form, setForm]         = useState<CompanyProfile>(EMPTY);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/user/settings')
      .then(r => r.json())
      .then(d => setForm({
        companyName:           d.companyName           ?? '',
        companyTagline:        d.companyTagline        ?? '',
        logoUrl:               d.logoUrl               ?? '',
        companyPhone:          d.companyPhone          ?? '',
        companyAddress:        d.companyAddress        ?? '',
        companyWebsite:        d.companyWebsite        ?? '',
        defaultProjectManager: d.defaultProjectManager ?? '',
      }))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSaved(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/user/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setForm(prev => ({ ...prev, logoUrl: data.logoUrl }));
      setSaved(false);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/user/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading…</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <BuildingOffice2Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Company Profile</h3>
        <span className="text-xs text-gray-400">— appears on generated proposals</span>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

      {/* Row 1: Name + Tagline */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Company Name</label>
          <input name="companyName" type="text" value={form.companyName}
            onChange={handleChange} className="form-input mt-1" placeholder="Acme Security Systems" />
        </div>
        <div>
          <label className="form-label">Tagline</label>
          <input name="companyTagline" type="text" value={form.companyTagline}
            onChange={handleChange} className="form-input mt-1" placeholder="Camera &amp; Security Management Systems" />
        </div>
      </div>

      {/* Row 2: Logo + Website */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Company Logo</label>
          <div className="mt-1 flex items-center gap-3">
            {form.logoUrl && (
              <img src={form.logoUrl} alt="Logo preview"
                className="h-10 w-auto object-contain rounded border border-gray-200 p-1 bg-white" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-xs"
            >
              <ArrowUpTrayIcon className="w-3.5 h-3.5 mr-1.5 inline-block" />
              {uploading ? 'Uploading…' : form.logoUrl ? 'Replace Logo' : 'Upload Logo'}
            </button>
            {form.logoUrl && (
              <button type="button" onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                className="text-xs text-red-500 hover:text-red-700">Remove</button>
            )}
          </div>
          {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
          <p className="mt-1 text-xs text-gray-400">PNG, JPG, SVG, WebP — max 2 MB</p>
        </div>
        <div>
          <label className="form-label">Website</label>
          <input name="companyWebsite" type="url" value={form.companyWebsite}
            onChange={handleChange} className="form-input mt-1" placeholder="https://www.example.com" />
        </div>
      </div>

      {/* Row 3: Phone + PM */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Telephone</label>
          <input name="companyPhone" type="tel" value={form.companyPhone}
            onChange={handleChange} className="form-input mt-1" placeholder="+1 (555) 000-0000" />
        </div>
        <div>
          <label className="form-label">Default Project Manager</label>
          <input name="defaultProjectManager" type="text" value={form.defaultProjectManager}
            onChange={handleChange} className="form-input mt-1" placeholder="Full name" />
        </div>
      </div>

      {/* Row 4: Address */}
      <div>
        <label className="form-label">Company Address</label>
        <textarea name="companyAddress" rows={2} value={form.companyAddress}
          onChange={handleChange} className="form-input mt-1 resize-none"
          placeholder="123 Main St, Suite 100&#10;New York, NY 10001" />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Company Profile'}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Saved</span>}
      </div>
    </form>
  );
}
