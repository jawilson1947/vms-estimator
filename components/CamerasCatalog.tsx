'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  CameraIcon,
  CheckIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

type CameraType   = 'Dome' | 'Fisheye' | 'Turret' | 'Other';
type Environment  = 'Indoor' | 'Outdoor' | 'Both';
type ResClass     = '4K' | '8K' | '';
type PanDeg       = 90 | 180 | 350;
type MountOption  = 'Wall' | 'Ceiling' | 'Recessed';

interface CameraModel {
  id:                 number;
  manufacturer:       string | null;
  model:              string | null;
  cameraType:         CameraType | null;
  ptz:                boolean;
  panDegrees:         number | null;
  zoomX:              string | null;
  audio:              boolean;
  motionDetection:    boolean;
  resolution:         string | null;
  megapixels:         number | null;
  cost:               number | null;
  lensCount:          number | null;
  motorizedLens:      boolean;
  indoorOutdoor:      Environment | null;
  imageUrl:           string | null;
  nightVision:        boolean;
  microphone:         boolean;
  rangeFt:            number | null;
  resolutionClass:    string | null;
  vandalProof:        boolean;
  url:                string | null;
  ssd:                boolean;
  fps:                number | null;
  humanVehicleDetect: boolean;
  mount:              string | null; // JSON array string
  comment:            string | null;
}

const EMPTY_FORM: Omit<CameraModel, 'id'> = {
  manufacturer: '',       model: '',          cameraType: null,
  ptz: false,             panDegrees: null,   zoomX: '',
  audio: false,           motionDetection: false,
  resolution: '',         megapixels: null,   cost: null,
  lensCount: null,        motorizedLens: false,
  indoorOutdoor: null,    imageUrl: '',       nightVision: false,
  microphone: false,      rangeFt: null,      resolutionClass: '',
  vandalProof: false,     url: '',            ssd: false,
  fps: null,              humanVehicleDetect: false,
  mount: null,            comment: null,
};

const MOUNT_OPTIONS: MountOption[] = ['Wall', 'Ceiling', 'Recessed'];
const PAN_OPTIONS: PanDeg[]        = [90, 180, 350];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMounts(raw: string | null): MountOption[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as MountOption[]; } catch { return []; }
}

function typeColor(t: CameraType | null) {
  const map: Record<string, string> = {
    Dome:    'bg-blue-50 text-blue-700',
    Fisheye: 'bg-purple-50 text-purple-700',
    Turret:  'bg-green-50 text-green-700',
    Other:   'bg-gray-100 text-gray-600',
  };
  return t ? map[t] ?? 'bg-gray-100 text-gray-600' : '';
}

function envColor(e: Environment | null) {
  const map: Record<string, string> = {
    Indoor:  'bg-amber-50 text-amber-700',
    Outdoor: 'bg-teal-50 text-teal-700',
    Both:    'bg-sky-50 text-sky-700',
  };
  return e ? map[e] ?? '' : '';
}

// ─── Camera Card ──────────────────────────────────────────────────────────────

function CameraCard({
  cam,
  onEdit,
  onDelete,
}: {
  cam: CameraModel;
  onEdit:   (c: CameraModel) => void;
  onDelete: (id: number)     => void;
}) {
  const mounts = parseMounts(cam.mount);

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* Image */}
      <div className="relative h-36 bg-gray-100 flex items-center justify-center shrink-0">
        {cam.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cam.imageUrl} alt={cam.model ?? ''} className="h-full w-full object-contain" />
        ) : (
          <CameraIcon className="w-10 h-10 text-gray-300" />
        )}
        {cam.resolutionClass && (
          <span className="absolute top-2 left-2 text-xs font-bold bg-black/70 text-white px-1.5 py-0.5 rounded">
            {cam.resolutionClass}
          </span>
        )}
        {cam.ptz && (
          <span className="absolute top-2 right-2 text-xs font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded">
            PTZ
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        {/* Make / Model */}
        <div>
          <p className="text-xs text-gray-400 leading-none">{cam.manufacturer ?? '—'}</p>
          <p className="font-semibold text-gray-900 text-sm truncate">{cam.model ?? 'Unnamed'}</p>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1">
          {cam.cameraType && (
            <span className={`badge ${typeColor(cam.cameraType)}`}>{cam.cameraType}</span>
          )}
          {cam.indoorOutdoor && (
            <span className={`badge ${envColor(cam.indoorOutdoor)}`}>{cam.indoorOutdoor}</span>
          )}
        </div>

        {/* Specs grid */}
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs mt-1">
          {cam.resolution && (
            <>
              <dt className="text-gray-400">Resolution</dt>
              <dd className="text-gray-700 font-mono truncate">{cam.resolution}</dd>
            </>
          )}
          {cam.megapixels != null && (
            <>
              <dt className="text-gray-400">Megapixels</dt>
              <dd className="text-gray-700">{cam.megapixels} MP</dd>
            </>
          )}
          {cam.fps != null && (
            <>
              <dt className="text-gray-400">FPS</dt>
              <dd className="text-gray-700">{cam.fps}</dd>
            </>
          )}
          {cam.lensCount != null && (
            <>
              <dt className="text-gray-400">Lenses</dt>
              <dd className="text-gray-700">{cam.lensCount}{cam.motorizedLens ? ' (motorized)' : ''}</dd>
            </>
          )}
          {cam.rangeFt != null && (
            <>
              <dt className="text-gray-400">Range</dt>
              <dd className="text-gray-700">{cam.rangeFt} ft</dd>
            </>
          )}
          {cam.cost != null && (
            <>
              <dt className="text-gray-400">Cost</dt>
              <dd className="text-gray-700">${Number(cam.cost).toFixed(2)}</dd>
            </>
          )}
        </dl>

        {/* Feature chips */}
        <div className="flex flex-wrap gap-1 mt-1">
          {cam.nightVision       && <span className="badge bg-gray-800 text-gray-100">Night Vision</span>}
          {cam.audio             && <span className="badge bg-gray-100 text-gray-600">Audio</span>}
          {cam.microphone        && <span className="badge bg-gray-100 text-gray-600">Mic</span>}
          {cam.motionDetection   && <span className="badge bg-gray-100 text-gray-600">Motion</span>}
          {cam.humanVehicleDetect && <span className="badge bg-gray-100 text-gray-600">H/V Detect</span>}
          {cam.vandalProof       && <span className="badge bg-red-50 text-red-700">Vandal Proof</span>}
          {cam.ssd               && <span className="badge bg-gray-100 text-gray-600">SSD</span>}
          {cam.ptz && cam.panDegrees != null && (
            <span className="badge bg-indigo-50 text-indigo-700">Pan {cam.panDegrees}°</span>
          )}
          {cam.ptz && cam.zoomX  && <span className="badge bg-indigo-50 text-indigo-700">{cam.zoomX} Zoom</span>}
        </div>

        {/* Mount */}
        {mounts.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">Mount: {mounts.join(', ')}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-gray-100">
        <button
          onClick={() => onEdit(cam)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
        </button>
        {cam.url && (
          <a
            href={cam.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-blue-500 hover:bg-blue-50 transition-colors border-l border-gray-100"
          >
            Spec Sheet ↗
          </a>
        )}
        <button
          onClick={() => onDelete(cam.id)}
          className="flex items-center justify-center px-3 py-2 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors border-l border-gray-100"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Bool field helper ────────────────────────────────────────────────────────

function BoolField({
  label, name, checked, onChange,
}: { label: string; name: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
        }`}
      >
        {checked && <CheckIcon className="w-2.5 h-2.5 text-white" />}
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ─── Camera Form Modal ────────────────────────────────────────────────────────

function CameraFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: CameraModel | null;
  onSave:  (data: Omit<CameraModel, 'id'>) => Promise<void>;
  onClose: () => void;
}) {
  // Prisma returns enum keys (DOME, INDOOR); form options use display strings (Dome, Indoor)
  function normalizeInitial(m: CameraModel): Omit<CameraModel, 'id'> {
    const typeMap: Record<string, CameraType> = {
      DOME: 'Dome', FISHEYE: 'Fisheye', TURRET: 'Turret', OTHER: 'Other',
    };
    const envMap: Record<string, Environment> = {
      INDOOR: 'Indoor', OUTDOOR: 'Outdoor', BOTH: 'Both',
    };
    return {
      ...m,
      cameraType:    m.cameraType    ? (typeMap[m.cameraType]    ?? m.cameraType)    as CameraType    : null,
      indoorOutdoor: m.indoorOutdoor ? (envMap[m.indoorOutdoor]  ?? m.indoorOutdoor) as Environment : null,
    };
  }

  const [form, setForm] = useState<Omit<CameraModel, 'id'>>(
    initial ? normalizeInitial(initial) : { ...EMPTY_FORM }
  );
  const [mounts,      setMounts]      = useState<MountOption[]>(parseMounts(initial?.mount ?? null));
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [saved,       setSaved]       = useState(false);
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imageUrl ?? null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function toggleMount(m: MountOption) {
    setMounts(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let resolvedImageUrl = form.imageUrl;

      // If user picked a new image file, upload it first
      if (imageFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append('image', imageFile);
        const res = await fetch('/api/cameras/upload-image', { method: 'POST', body: fd });
        setUploading(false);
        if (!res.ok) throw new Error('Image upload failed');
        const { url } = await res.json();
        resolvedImageUrl = url;
      }

      await onSave({
        ...form,
        imageUrl: resolvedImageUrl,
        mount: mounts.length ? JSON.stringify(mounts) : null,
      });

      setSaved(true);
      // Close after brief confirmation
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  const inp  = 'form-input w-full';
  const sel  = 'form-select w-full';
  const lbl  = 'block text-xs font-medium text-gray-600 mb-1';
  const fld  = 'flex flex-col';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? 'Edit Camera Model' : 'Add Camera Model'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Identity ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className={fld}>
                <label className={lbl}>Manufacturer</label>
                <input className={inp} maxLength={55} value={form.manufacturer ?? ''} onChange={e => set('manufacturer', e.target.value || null)} />
              </div>
              <div className={fld}>
                <label className={lbl}>Model</label>
                <input className={inp} maxLength={55} value={form.model ?? ''} onChange={e => set('model', e.target.value || null)} />
              </div>
              <div className={fld}>
                <label className={lbl}>Type</label>
                <select className={sel} value={form.cameraType ?? ''} onChange={e => set('cameraType', (e.target.value as CameraType) || null)}>
                  <option value="">— Select —</option>
                  {(['Dome','Fisheye','Turret','Other'] as CameraType[]).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className={fld}>
                <label className={lbl}>Indoor / Outdoor</label>
                <select className={sel} value={form.indoorOutdoor ?? ''} onChange={e => set('indoorOutdoor', (e.target.value as Environment) || null)}>
                  <option value="">— Select —</option>
                  {(['Indoor','Outdoor','Both'] as Environment[]).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className={fld}>
                <label className={lbl}>Product URL</label>
                <input className={inp} type="url" maxLength={255} placeholder="https://…" value={form.url ?? ''} onChange={e => set('url', e.target.value || null)} />
              </div>
              <div className={fld}>
                <label className={lbl}>Camera Image</label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImagePick}
                />
                {imagePreview ? (
                  <div className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Camera"
                      className="w-full h-32 object-contain rounded-lg border border-gray-200 bg-gray-50 cursor-zoom-in"
                      onClick={() => setLightboxOpen(true)}
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg"
                    >
                      <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium flex items-center gap-1 transition-opacity">
                        <ArrowUpTrayIcon className="w-4 h-4" /> Replace
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    <ArrowUpTrayIcon className="w-5 h-5" />
                    <span className="text-xs">Upload image</span>
                  </button>
                )}
                {/* Lightbox */}
                {lightboxOpen && imagePreview && (
                  <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setLightboxOpen(false)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Camera"
                      className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      className="absolute top-4 right-4 text-white/70 hover:text-white"
                      onClick={() => setLightboxOpen(false)}
                    >
                      <XMarkIcon className="w-7 h-7" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Optics ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Optics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className={fld}>
                <label className={lbl}>Resolution</label>
                <input className={inp} maxLength={22} placeholder="3840x2160" value={form.resolution ?? ''} onChange={e => set('resolution', e.target.value || null)} />
              </div>
              <div className={fld}>
                <label className={lbl}>Megapixels</label>
                <input className={inp} type="number" step="0.01" min="0" value={form.megapixels ?? ''} onChange={e => set('megapixels', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className={fld}>
                <label className={lbl}>Resolution Class</label>
                <select className={sel} value={form.resolutionClass ?? ''} onChange={e => set('resolutionClass', (e.target.value as ResClass) || null)}>
                  <option value="">—</option>
                  <option value="4K">4K</option>
                  <option value="8K">8K</option>
                </select>
              </div>
              <div className={fld}>
                <label className={lbl}>Number of Lenses</label>
                <input className={inp} type="number" min="1" value={form.lensCount ?? ''} onChange={e => set('lensCount', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className={fld}>
                <label className={lbl}>FPS</label>
                <input className={inp} type="number" min="1" value={form.fps ?? ''} onChange={e => set('fps', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="flex items-end pb-1">
                <BoolField label="Motorized Lens" name="motorizedLens" checked={form.motorizedLens} onChange={v => set('motorizedLens', v)} />
              </div>
            </div>
          </section>

          {/* ── PTZ ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">PTZ</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center">
                <BoolField label="PTZ Enabled" name="ptz" checked={form.ptz} onChange={v => set('ptz', v)} />
              </div>
              {form.ptz && (
                <>
                  <div className={fld}>
                    <label className={lbl}>Pan (degrees)</label>
                    <select className={sel} value={form.panDegrees ?? ''} onChange={e => set('panDegrees', e.target.value ? Number(e.target.value) as PanDeg : null)}>
                      <option value="">—</option>
                      {PAN_OPTIONS.map(p => <option key={p} value={p}>{p}°</option>)}
                    </select>
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Zoom</label>
                    <input className={inp} maxLength={20} placeholder="e.g. 40X" value={form.zoomX ?? ''} onChange={e => set('zoomX', e.target.value || null)} />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── Features ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Features</h3>
            <div className="grid grid-cols-3 gap-x-6 gap-y-3 items-start">
              <BoolField label="Audio"                    name="audio"              checked={form.audio}              onChange={v => set('audio', v)} />
              <BoolField label="Microphone"               name="microphone"         checked={form.microphone}         onChange={v => set('microphone', v)} />
              <BoolField label="Motion Detection"         name="motionDetection"    checked={form.motionDetection}    onChange={v => set('motionDetection', v)} />
              <BoolField label="Night Vision"             name="nightVision"        checked={form.nightVision}        onChange={v => set('nightVision', v)} />
              <BoolField label="Human/Vehicle Detection"  name="humanVehicleDetect" checked={form.humanVehicleDetect} onChange={v => set('humanVehicleDetect', v)} />
              <BoolField label="Vandal Proof"             name="vandalProof"        checked={form.vandalProof}        onChange={v => set('vandalProof', v)} />
              {/* SSD + Comment on the same row */}
              <div className="flex items-start pt-0.5">
                <BoolField label="SSD" name="ssd" checked={form.ssd} onChange={v => set('ssd', v)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Comment</label>
                <textarea
                  className="form-input w-full resize-none text-sm"
                  rows={3}
                  placeholder="Additional comments or follow-up items…"
                  value={form.comment ?? ''}
                  onChange={e => set('comment', e.target.value || null)}
                />
              </div>
            </div>
          </section>

          {/* ── Physical / Commercial ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Physical &amp; Commercial</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className={fld}>
                <label className={lbl}>Night Vision Range (ft)</label>
                <input className={inp} type="number" min="0" value={form.rangeFt ?? ''} onChange={e => set('rangeFt', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className={fld}>
                <label className={lbl}>Cost ($)</label>
                <input className={inp} type="number" step="0.01" min="0" value={form.cost ?? ''} onChange={e => set('cost', e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>

            {/* Mount */}
            <div className="mt-4">
              <label className={lbl}>Mount (select all that apply)</label>
              <div className="flex gap-4 mt-1">
                {MOUNT_OPTIONS.map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => toggleMount(m)}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        mounts.includes(m) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {mounts.includes(m) && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-sm text-gray-700">{m}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {/* Footer */}
        <div className="px-6 pb-4 border-t border-gray-200 pt-4 space-y-3">
          {saved && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
              <CheckCircleIcon className="w-5 h-5 shrink-0" />
              Camera model saved successfully!
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
            <button
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              disabled={saving || saved}
              className="btn-primary"
            >
              {uploading ? 'Uploading image…' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Catalog Component ───────────────────────────────────────────────────

export function CamerasCatalog() {
  const [cameras,    setCameras]    = useState<CameraModel[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEnv,  setFilterEnv]  = useState('');
  const [filterPtz,  setFilterPtz]  = useState('');
  const [editing,    setEditing]    = useState<CameraModel | null | undefined>(undefined); // undefined = closed, null = new
  const [deleteId,   setDeleteId]   = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)     params.set('search', search);
    if (filterType) params.set('type', filterType);
    if (filterEnv)  params.set('indoorOutdoor', filterEnv);
    if (filterPtz)  params.set('ptz', filterPtz);
    const res = await fetch(`/api/cameras?${params}`);
    if (res.ok) setCameras(await res.json());
    setLoading(false);
  }, [search, filterType, filterEnv, filterPtz]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(data: Omit<CameraModel, 'id'>) {
    const isEdit = editing && editing.id;
    const url    = isEdit ? `/api/cameras/${editing!.id}` : '/api/cameras';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error ?? 'Save failed');
    }
    setEditing(undefined);
    void load();
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDeleteId(null);
      setCameras(prev => prev.filter(c => c.id !== id));
    }
  }

  const hasFilters = search || filterType || filterEnv || filterPtz;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Camera Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cameras.length} model{cameras.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setEditing(null)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Add Camera
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="form-input pl-8 w-52"
            placeholder="Search make, model…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select className="form-select w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {(['Dome','Fisheye','Turret','Other'] as CameraType[]).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select className="form-select w-36" value={filterEnv} onChange={e => setFilterEnv(e.target.value)}>
          <option value="">All Environments</option>
          {(['Indoor','Outdoor','Both'] as Environment[]).map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select className="form-select w-28" value={filterPtz} onChange={e => setFilterPtz(e.target.value)}>
          <option value="">PTZ: Any</option>
          <option value="true">PTZ Only</option>
          <option value="false">Fixed Only</option>
        </select>

        {hasFilters && (
          <button
            className="btn-secondary"
            onClick={() => { setSearch(''); setFilterType(''); setFilterEnv(''); setFilterPtz(''); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Grid / Empty */}
      {loading ? (

        <div className="card p-12 text-center text-sm text-gray-400">Loading…</div>
      ) : cameras.length === 0 ? (
        <div className="card p-12 text-center">
          <CameraIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {hasFilters ? 'No cameras match your filters.' : 'No cameras yet.'}
          </p>
          {!hasFilters && (
            <button onClick={() => setEditing(null)} className="btn-primary mt-4 inline-flex">
              <PlusIcon className="w-4 h-4" /> Add first camera
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {cameras.map(c => (
            <CameraCard
              key={c.id}
              cam={c}
              onEdit={setEditing}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {editing !== undefined && (
        <CameraFormModal
          initial={editing}
          onSave={handleSave}
          onClose={() => setEditing(undefined)}
        />
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Camera Model?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will unassign it from any survey locations and remove it from the catalog.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
