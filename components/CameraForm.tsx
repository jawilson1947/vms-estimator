'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Model    = { id: number; manufacturer: string | null; modelNumber: string | null; };
type Location = { id: number; areaName: string | null; floor: string | null;
  building: { buildingName: string; site: { siteName: string } }; };

interface Props {
  models:      Model[];
  locations:   Location[];
  initialData?: Partial<FormData>;
  cameraId?:   number;
}

interface FormData {
  cameraCode: string; cameraName: string; modelId: string; locationId: string; status: string;
  serialNumber: string; assetTag: string; firmwareVersion: string;
  installDate: string; warrantyExpiration: string;
  ipAddress: string; macAddress: string; vlanId: string;
  switchName: string; switchPort: string; nvrName: string;
  recordingMode: string; retentionDays: string; bitrateMbps: string; frameRate: string;
  usernameChanged: boolean; httpsEnabled: boolean; privacyMaskEnabled: boolean;
  notes: string;
}

const empty: FormData = {
  cameraCode: '', cameraName: '', modelId: '', locationId: '', status: 'PLANNED',
  serialNumber: '', assetTag: '', firmwareVersion: '', installDate: '', warrantyExpiration: '',
  ipAddress: '', macAddress: '', vlanId: '', switchName: '', switchPort: '', nvrName: '',
  recordingMode: '', retentionDays: '', bitrateMbps: '', frameRate: '',
  usernameChanged: false, httpsEnabled: false, privacyMaskEnabled: false, notes: '',
};

const tabs = ['Identification', 'Network', 'Recording', 'Security'] as const;
type Tab = typeof tabs[number];

const statusOptions   = ['PLANNED','INSTALLED','ACTIVE','OFFLINE','NEEDS_REPAIR','RETIRED'];
const recordingModes  = ['CONTINUOUS','MOTION','EVENT','SCHEDULED'];

export function CameraForm({ models, locations, initialData, cameraId }: Props) {
  const router  = useRouter();
  const isEdit  = !!cameraId;
  const [tab, setTab]       = useState<Tab>('Identification');
  const [form, setForm]     = useState<FormData>({ ...empty, ...initialData });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  function set(name: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [name]: value }));
  }
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, type } = e.target;
    set(name as keyof FormData, type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const res = await fetch(isEdit ? `/api/cameras/${cameraId}` : '/api/cameras', {
      method:  isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });

    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Something went wrong.'); return; }
    const saved = await res.json();
    router.push(`/cameras/${saved.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Delete this camera?')) return;
    await fetch(`/api/cameras/${cameraId}`, { method: 'DELETE' });
    router.push('/cameras');
    router.refresh();
  }

  const TF = ({ label, name, placeholder = '', type = 'text', required = false }:
    { label: string; name: keyof FormData; placeholder?: string; type?: string; required?: boolean }) => (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} name={name} value={String(form[name])} onChange={handleChange}
        placeholder={placeholder} required={required} className="form-input" />
    </div>
  );

  const CB = ({ label, name }: { label: string; name: 'usernameChanged' | 'httpsEnabled' | 'privacyMaskEnabled' }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" name={name} checked={!!form[name]}
        onChange={handleChange} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Identification ───────────────────────────────────────────────────── */}
      {tab === 'Identification' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <TF label="Camera Code" name="cameraCode" placeholder="CAM-001" required />
            <TF label="Camera Name" name="cameraName" placeholder="Lobby Front — Camera 1" required />
          </div>

          <div>
            <label className="form-label">Camera Model</label>
            <select name="modelId" value={form.modelId} onChange={handleChange} className="form-select">
              <option value="">— Select model —</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {[m.manufacturer, m.modelNumber].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Camera Location</label>
            <select name="locationId" value={form.locationId} onChange={handleChange} className="form-select">
              <option value="">— Select location —</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.building.site.siteName} › {l.building.buildingName} › {l.areaName ?? 'Area'}{l.floor ? ` (Floor ${l.floor})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="form-select">
              {statusOptions.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <TF label="Serial Number"     name="serialNumber"      placeholder="SN-XXXXXXXXXX" />
            <TF label="Asset Tag"         name="assetTag"          placeholder="ASSET-001" />
            <TF label="Firmware Version"  name="firmwareVersion"   placeholder="9.80.1" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <TF label="Install Date"       name="installDate"       type="date" />
            <TF label="Warranty Expiration" name="warrantyExpiration" type="date" />
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange}
              rows={3} className="form-input resize-none" />
          </div>
        </div>
      )}

      {/* ── Network ──────────────────────────────────────────────────────────── */}
      {tab === 'Network' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <TF label="IP Address"  name="ipAddress"  placeholder="10.20.1.101" />
            <TF label="MAC Address" name="macAddress" placeholder="AA:BB:CC:DD:EE:FF" />
            <TF label="VLAN ID"     name="vlanId"     placeholder="20" type="number" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <TF label="Switch Name" name="switchName" placeholder="SW-A1" />
            <TF label="Switch Port" name="switchPort" placeholder="Gi0/1" />
          </div>
          <TF label="NVR / Recording Server" name="nvrName" placeholder="NVR-01" />
        </div>
      )}

      {/* ── Recording ────────────────────────────────────────────────────────── */}
      {tab === 'Recording' && (
        <div className="space-y-4">
          <div>
            <label className="form-label">Recording Mode</label>
            <select name="recordingMode" value={form.recordingMode} onChange={handleChange} className="form-select">
              <option value="">— Select mode —</option>
              {recordingModes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <TF label="Retention (days)" name="retentionDays" type="number" placeholder="30" />
            <TF label="Bitrate (Mbps)"   name="bitrateMbps"   type="number" placeholder="8.0" />
            <TF label="Frame Rate (fps)" name="frameRate"     type="number" placeholder="15" />
          </div>
        </div>
      )}

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      {tab === 'Security' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Security hardening status for this camera.</p>
          <div className="card p-4 space-y-3">
            <CB label="Default username changed"      name="usernameChanged" />
            <CB label="HTTPS / TLS enabled"           name="httpsEnabled" />
            <CB label="Privacy masking enabled"       name="privacyMaskEnabled" />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2">
            {[
              { label: 'Username Changed', ok: form.usernameChanged },
              { label: 'HTTPS Enabled',    ok: form.httpsEnabled },
              { label: 'Privacy Mask',     ok: form.privacyMaskEnabled },
            ].map(({ label, ok }) => (
              <div key={label} className={`card p-3 text-center border-2 ${ok ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                <div className={`text-xl mb-1 ${ok ? 'text-green-600' : 'text-amber-500'}`}>{ok ? '✓' : '!'}</div>
                <div className="text-xs font-medium text-gray-700">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-8 pt-4 border-t border-gray-200">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Camera'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
        {isEdit && (
          <button type="button" onClick={handleDelete} className="btn-danger ml-auto">Delete Camera</button>
        )}
      </div>
    </form>
  );
}
