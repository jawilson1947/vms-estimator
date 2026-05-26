'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, PencilSquareIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

type Model = {
  id: number; manufacturer: string | null; modelNumber: string | null;
  cameraType: string | null; indoorOutdoor: string | null; resolution: string | null;
  lensType: string | null; focalLength: string | null; fieldOfView: string | null;
  irDistance: string | null; wdr: string | null; lowLightRating: string | null;
  codecSupport: string | null; poeStandard: string | null; maxPowerWatts: unknown;
  weatherRating: string | null; vandalRating: string | null; onvifProfile: string | null;
  notes: string | null; _count: { cameras: number };
};

const empty = {
  manufacturer: '', modelNumber: '', cameraType: '', indoorOutdoor: '',
  resolution: '', lensType: '', focalLength: '', fieldOfView: '',
  irDistance: '', wdr: '', lowLightRating: '', codecSupport: '',
  poeStandard: '', maxPowerWatts: '', weatherRating: '', vandalRating: '',
  onvifProfile: '', notes: '',
};

const cameraTypes   = ['DOME','BULLET','TURRET','PTZ','FISHEYE','LPR','OTHER'];
const environments  = ['INDOOR','OUTDOOR','BOTH'];

export function CameraModelManager({ initialModels }: { initialModels: Model[] }) {
  const router = useRouter();
  const [models, setModels]     = useState(initialModels);
  const [editing, setEditing]   = useState<number | 'new' | null>(null);
  const [form, setForm]         = useState(empty);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  function startNew()  { setForm(empty); setEditing('new'); setError(''); }
  function startEdit(m: Model) {
    setForm({
      manufacturer: m.manufacturer ?? '', modelNumber: m.modelNumber ?? '',
      cameraType: m.cameraType ?? '', indoorOutdoor: m.indoorOutdoor ?? '',
      resolution: m.resolution ?? '', lensType: m.lensType ?? '',
      focalLength: m.focalLength ?? '', fieldOfView: m.fieldOfView ?? '',
      irDistance: m.irDistance ?? '', wdr: m.wdr ?? '',
      lowLightRating: m.lowLightRating ?? '', codecSupport: m.codecSupport ?? '',
      poeStandard: m.poeStandard ?? '', maxPowerWatts: m.maxPowerWatts ? String(m.maxPowerWatts) : '',
      weatherRating: m.weatherRating ?? '', vandalRating: m.vandalRating ?? '',
      onvifProfile: m.onvifProfile ?? '', notes: m.notes ?? '',
    });
    setEditing(m.id);
    setError('');
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    setError(''); setSaving(true);
    const isNew = editing === 'new';
    const url   = isNew ? '/api/camera-models' : `/api/camera-models/${editing}`;
    const res   = await fetch(url, {
      method:  isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? 'Save failed.'); return; }
    setEditing(null);
    router.refresh();
    const updated = await fetch('/api/camera-models').then(r => r.json());
    setModels(updated);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this camera model?')) return;
    const res = await fetch(`/api/camera-models/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error); return; }
    setModels(prev => prev.filter(m => m.id !== id));
  }

  const F = ({ label, name, placeholder = '', type = 'text' }: { label: string; name: keyof typeof empty; placeholder?: string; type?: string }) => (
    <div>
      <label className="form-label text-xs">{label}</label>
      <input type={type} name={name} value={form[name]} onChange={handleChange}
        placeholder={placeholder} className="form-input text-sm" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Model list */}
      {models.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Manufacturer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Model</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Resolution</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">PoE</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">In Use</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {models.map(m => (
                <>
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.manufacturer ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{m.modelNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.cameraType ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.resolution ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.poeStandard ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="badge bg-blue-50 text-blue-700">{m._count.cameras}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                          {expanded === m.id ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </button>
                        <button onClick={() => startEdit(m)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === m.id && (
                    <tr key={`${m.id}-exp`} className="bg-blue-50/40">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                          {[
                            ['Lens Type',      m.lensType],     ['Focal Length',  m.focalLength],
                            ['Field of View',  m.fieldOfView],  ['IR Distance',   m.irDistance],
                            ['WDR',            m.wdr],          ['Low Light',     m.lowLightRating],
                            ['Codec Support',  m.codecSupport], ['Max Watts',     m.maxPowerWatts ? `${m.maxPowerWatts}W` : null],
                            ['Weather Rating', m.weatherRating],['Vandal Rating', m.vandalRating],
                            ['ONVIF Profile',  m.onvifProfile], ['Indoor/Outdoor',m.indoorOutdoor],
                          ].map(([label, val]) => (
                            <div key={String(label)}>
                              <span className="text-gray-500">{label}: </span>
                              <span className="font-medium text-gray-800">{val ? String(val) : '—'}</span>
                            </div>
                          ))}
                        </div>
                        {m.notes && <p className="mt-2 text-xs text-gray-500 italic">{m.notes}</p>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit form */}
      {editing !== null ? (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editing === 'new' ? 'Add Camera Model' : 'Edit Camera Model'}
          </h3>
          {error && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <F label="Manufacturer"   name="manufacturer"   placeholder="Axis" />
            <F label="Model Number"   name="modelNumber"    placeholder="P3268-V" />
            <div>
              <label className="form-label text-xs">Camera Type</label>
              <select name="cameraType" value={form.cameraType} onChange={handleChange} className="form-select text-sm">
                <option value="">—</option>
                {cameraTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Indoor / Outdoor</label>
              <select name="indoorOutdoor" value={form.indoorOutdoor} onChange={handleChange} className="form-select text-sm">
                <option value="">—</option>
                {environments.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <F label="Resolution"     name="resolution"     placeholder="4K (8MP)" />
            <F label="Lens Type"      name="lensType"       placeholder="Varifocal" />
            <F label="Focal Length"   name="focalLength"    placeholder="3–9mm" />
            <F label="Field of View"  name="fieldOfView"    placeholder="110° H" />
            <F label="IR Distance"    name="irDistance"     placeholder="30m" />
            <F label="WDR"            name="wdr"            placeholder="120dB" />
            <F label="Low Light"      name="lowLightRating" placeholder="0.08 lux" />
            <F label="Codec Support"  name="codecSupport"   placeholder="H.265, H.264" />
            <F label="PoE Standard"   name="poeStandard"    placeholder="PoE+ (802.3at)" />
            <F label="Max Watts"      name="maxPowerWatts"  placeholder="25.5" type="number" />
            <F label="Weather Rating" name="weatherRating"  placeholder="IP66" />
            <F label="Vandal Rating"  name="vandalRating"   placeholder="IK10" />
            <F label="ONVIF Profile"  name="onvifProfile"   placeholder="S, G, T" />
          </div>
          <div className="mb-4">
            <label className="form-label text-xs">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange}
              rows={2} className="form-input resize-none text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editing === 'new' ? 'Add Model' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={startNew} className="btn-secondary w-full justify-center py-3 border-dashed">
          <PlusIcon className="w-4 h-4" /> Add Camera Model
        </button>
      )}
    </div>
  );
}
