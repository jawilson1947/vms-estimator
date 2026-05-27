'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CameraIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  PhotoIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  MicrophoneIcon,
  MagnifyingGlassIcon,
  DocumentIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { useVoice, useWaitForValue } from '@/context/VoiceContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SurveyImage {
  id: number;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}

interface SurveyCamera {
  id: number;
  cameraCode: string;
  cameraName: string;
  status: string;
  locationId: number | null;
  model?: { manufacturer: string | null; modelNumber: string | null; cameraType: string | null } | null;
}

interface SurveyLocation {
  id: number;
  buildingId: number;
  areaName: string | null;
  floor: string | null;
  surveyNotes: string | null;
  notes: string | null;
  mountingLocation: string | null;
  coveragePurpose: string | null;
  surveyedAt: string | null;
  cameras: SurveyCamera[];
  images: SurveyImage[];
}

interface SurveyFloorPlan {
  id: number;
  floor: string;
  originalFileName: string | null;
  fileUrl: string | null;
}

interface SurveyBuilding {
  id: number;
  buildingName: string;
  floorPlans: SurveyFloorPlan[];
  locations: SurveyLocation[];
}

interface SurveySite {
  id: number;
  siteName: string;
  buildings: SurveyBuilding[];
}

type Filter = 'all' | 'pending' | 'done';

// Camera picker types
interface AvailableCamera {
  id: number;
  cameraCode: string;
  cameraName: string;
  status: string;
  locationId: number | null;
  model?: { manufacturer: string | null; modelNumber: string | null; cameraType: string | null } | null;
}

interface AvailableCameraModel {
  id: number;
  manufacturer: string | null;
  modelNumber: string | null;
  cameraType: string | null;
  resolution: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDone(loc: SurveyLocation) {
  return !!loc.surveyedAt;
}

function statusChip(loc: SurveyLocation) {
  if (isDone(loc)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircleSolid className="w-3 h-3" />
        Surveyed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <ClockIcon className="w-3 h-3" />
      Pending
    </span>
  );
}

function cameraLabel(cam: SurveyCamera | AvailableCamera) {
  const model = cam.model
    ? [cam.model.manufacturer, cam.model.modelNumber].filter(Boolean).join(' ')
    : null;
  return model || cam.cameraName || cam.cameraCode;
}

// ── Camera picker ─────────────────────────────────────────────────────────────

interface CameraPickerProps {
  siteId: number;
  assignedCamera: SurveyCamera | null;
  onAssign: (cameraId: number | null, cameraModelId?: number) => Promise<void>;
  assigning: boolean;
}

function CameraPicker({ siteId, assignedCamera, onAssign, assigning }: CameraPickerProps) {
  const [inventory, setInventory]   = useState<AvailableCamera[]>([]);
  const [models,    setModels]      = useState<AvailableCameraModel[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [search,    setSearch]      = useState('');
  const [open,      setOpen]        = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/survey/cameras?siteId=${siteId}`)
      .then(r => r.json())
      .then(d => { setInventory(d.inventory ?? []); setModels(d.models ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const q = search.toLowerCase();

  const filteredInventory = inventory.filter(c =>
    !q ||
    c.cameraCode.toLowerCase().includes(q) ||
    c.cameraName.toLowerCase().includes(q) ||
    (c.model?.manufacturer ?? '').toLowerCase().includes(q) ||
    (c.model?.modelNumber  ?? '').toLowerCase().includes(q)
  );

  const filteredModels = models.filter(m =>
    !q ||
    (m.manufacturer ?? '').toLowerCase().includes(q) ||
    (m.modelNumber  ?? '').toLowerCase().includes(q) ||
    (m.cameraType   ?? '').toLowerCase().includes(q)
  );

  async function pick(cameraId: number | null, modelId?: number) {
    setOpen(false);
    setSearch('');
    await onAssign(cameraId, modelId);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Current assignment display */}
      <div className="flex items-center gap-2 mb-2">
        {assignedCamera ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <CameraIcon className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-800 truncate">{cameraLabel(assignedCamera)}</p>
              <p className="text-xs text-blue-500 truncate">{assignedCamera.cameraCode}</p>
            </div>
            <button
              onClick={() => pick(null)}
              disabled={assigning}
              className="shrink-0 text-blue-400 hover:text-red-500 transition-colors disabled:opacity-40"
              title="Unassign camera"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic flex-1">No camera assigned</p>
        )}

        <button
          onClick={() => setOpen(o => !o)}
          disabled={assigning || loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40 shrink-0"
        >
          {assigning ? (
            <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <CameraIcon className="w-3.5 h-3.5" />
          )}
          {assignedCamera ? 'Change' : 'Assign'}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {/* Search */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search cameras or models…"
                className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Unassign option */}
          {assignedCamera && (
            <button
              onClick={() => pick(null)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors border-b border-gray-50"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              Remove camera assignment
            </button>
          )}

          {/* Inventory section */}
          {filteredInventory.length > 0 && (
            <>
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                Inventory
              </p>
              {filteredInventory.map(cam => (
                <button
                  key={cam.id}
                  onClick={() => pick(cam.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    assignedCamera?.id === cam.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <CameraIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{cameraLabel(cam)}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {cam.cameraCode}
                      {cam.locationId && cam.locationId !== assignedCamera?.locationId
                        ? ' · currently assigned elsewhere'
                        : cam.locationId === null ? ' · unassigned' : ''}
                    </p>
                  </div>
                  {assignedCamera?.id === cam.id && (
                    <CheckCircleSolid className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                </button>
              ))}
            </>
          )}

          {/* Model library section */}
          {filteredModels.length > 0 && (
            <>
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                Model Library — creates planned camera
              </p>
              {filteredModels.map(m => (
                <button
                  key={m.id}
                  onClick={() => pick(null, m.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <CameraIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {[m.manufacturer, m.modelNumber].filter(Boolean).join(' ') || 'Unknown model'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {[m.cameraType, m.resolution].filter(Boolean).join(' · ') || 'No details'}
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}

          {filteredInventory.length === 0 && filteredModels.length === 0 && (
            <p className="px-4 py-4 text-xs text-gray-400 text-center">No cameras match your search.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add location modal ────────────────────────────────────────────────────────

const MAX_PHOTOS = 5;

interface QuickAddProps {
  buildings: SurveyBuilding[];
  defaultBuildingId?: number;
  onSave: (loc: SurveyLocation) => void;
  onClose: () => void;
}

interface PendingPhoto {
  file: File;
  preview: string;
}

function QuickAddSheet({ buildings, defaultBuildingId, onSave, onClose }: QuickAddProps) {
  const [buildingId, setBuildingId]   = useState(String(defaultBuildingId ?? buildings[0]?.id ?? ''));
  const [areaName,   setAreaName]     = useState('');
  const [floor,      setFloor]        = useState('');
  const [surveyNotes, setSurveyNotes] = useState('');
  const [pending,    setPending]      = useState<PendingPhoto[]>([]);
  const [saving,     setSaving]       = useState(false);
  const [saveLabel,  setSaveLabel]    = useState('');
  const [voiceField, setVoiceField]   = useState<string | null>(null);
  const [photoPrompted, setPhotoPrompted] = useState(false);
  const areaRef     = useRef<HTMLInputElement>(null);
  const photoRef    = useRef<HTMLInputElement>(null);

  const atLimit = pending.length >= MAX_PHOTOS;

  // ── Voice commands ──────────────────────────────────────────────────────────
  const { registerCommands, mode, activeField } = useVoice();
  const waitForValue = useWaitForValue();

  useEffect(() => {
    const unregister = registerCommands('quick-add', [
      {
        keywords: ['name'],
        action: () => {
          setVoiceField('areaName');
          waitForValue('Name', (val) => { setAreaName(val); setVoiceField(null); });
        },
      },
      {
        keywords: ['floor'],
        action: () => {
          setVoiceField('floor');
          waitForValue('Floor', (val) => { setFloor(val); setVoiceField(null); });
        },
      },
      {
        keywords: ['notes', 'note'],
        action: () => {
          setVoiceField('notes');
          waitForValue('Notes', (val) => { setSurveyNotes(val); setVoiceField(null); });
        },
      },
      {
        keywords: ['photo'],
        action: () => { if (!atLimit) setPhotoPrompted(true); },
      },
      {
        keywords: ['save'],
        action: () => { handleSave(false); },
      },
      {
        keywords: ['next'],
        action: () => { handleSave(true); },
      },
      {
        keywords: ['exit', 'cancel', 'close'],
        action: () => { onClose(); },
      },
    ]);
    return unregister;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCommands]);

  function voicePulse(field: string) {
    return voiceField === field || (mode === 'waitingForValue' && activeField?.toLowerCase() === field.toLowerCase())
      ? 'ring-2 ring-amber-400 ring-offset-1'
      : '';
  }

  function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const slots = MAX_PHOTOS - pending.length;
    const toAdd  = files.slice(0, slots).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPending(prev => [...prev, ...toAdd]);
    if (photoRef.current) photoRef.current.value = '';
  }

  function removePhoto(idx: number) {
    setPending(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function handleSave(andNext = false) {
    if (!areaName.trim()) { areaRef.current?.focus(); return; }
    setSaving(true);
    try {
      // 1. Create the location
      setSaveLabel('Creating location…');
      const res = await fetch('/api/survey/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId,
          areaName:    areaName.trim(),
          floor:       floor.trim() || null,
          surveyNotes: surveyNotes.trim() || null,
        }),
      });
      const loc: SurveyLocation = await res.json();

      // 2. Upload any queued photos
      const uploaded: SurveyImage[] = [];
      for (let i = 0; i < pending.length; i++) {
        setSaveLabel(`Uploading photo ${i + 1} of ${pending.length}…`);
        const fd = new FormData();
        fd.append('photo', pending[i].file);
        const pr = await fetch(`/api/survey/locations/${loc.id}/photos`, { method: 'POST', body: fd });
        if (pr.ok) uploaded.push(await pr.json());
      }

      // Clean up object URLs
      pending.forEach(p => URL.revokeObjectURL(p.preview));

      onSave({ ...loc, images: uploaded });

      if (andNext) {
        setAreaName('');
        setFloor('');
        setSurveyNotes('');
        setPending([]);
        setSaveLabel('');
        setTimeout(() => areaRef.current?.focus(), 50);
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
      setSaveLabel('');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Location</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Building */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Building</label>
            <select
              value={buildingId}
              onChange={e => setBuildingId(e.target.value)}
              className="input-field text-sm w-full"
            >
              {buildings.map(b => (
                <option key={b.id} value={String(b.id)}>{b.buildingName}</option>
              ))}
            </select>
          </div>

          {/* Area name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Area / Location Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={areaRef}
              autoFocus
              value={areaName}
              onChange={e => setAreaName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(true); }}
              placeholder="e.g. Front Lobby, Parking Lot East"
              className={`input-field text-sm w-full ${voicePulse('areaName')}`}
            />
          </div>

          {/* Floor */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Floor</label>
            <input
              value={floor}
              onChange={e => setFloor(e.target.value)}
              placeholder="e.g. 1, 2, Basement"
              className={`input-field text-sm w-full ${voicePulse('floor')}`}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea
              value={surveyNotes}
              onChange={e => setSurveyNotes(e.target.value)}
              rows={2}
              placeholder="Quick observations, mounting ideas…"
              className={`input-field text-sm w-full resize-none ${voicePulse('notes')}`}
            />
          </div>

          {/* Voice hint */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <MicrophoneIcon className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-400">Say: <strong className="text-gray-600">Name · Floor · Notes · Photo · Save · Next · Exit</strong></span>
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Photos
                <span className={`ml-1.5 font-normal ${atLimit ? 'text-amber-500' : 'text-gray-400'}`}>
                  ({pending.length}/{MAX_PHOTOS})
                </span>
              </span>
              {!atLimit && (
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                >
                  <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                  Add Photo
                </button>
              )}
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => { addPhoto(e); setPhotoPrompted(false); }}
              />
            </div>

            {/* Voice photo prompt — shown when user says "Photo" */}
            {photoPrompted && !atLimit && (
              <button
                type="button"
                onClick={() => { photoRef.current?.click(); setPhotoPrompted(false); }}
                className="w-full mb-2 py-3 rounded-xl bg-amber-50 border-2 border-amber-400 flex items-center justify-center gap-2 text-amber-700 font-semibold text-sm animate-pulse"
              >
                <PhotoIcon className="w-5 h-5" />
                Tap here to capture photo
              </button>
            )}

            {pending.length === 0 ? (
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                <PhotoIcon className="w-6 h-6" />
                <span className="text-xs">Add up to {MAX_PHOTOS} photos</span>
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {pending.map((p, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-sm">
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center"
                      title="Remove photo"
                    >
                      <XMarkIcon className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {!atLimit && (
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                )}
                {atLimit && (
                  <div className="aspect-square rounded-lg border-2 border-amber-200 bg-amber-50 flex flex-col items-center justify-center text-amber-500">
                    <span className="text-sm font-bold">5</span>
                    <span className="text-xs">Max</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn-primary flex-1 text-sm"
            >
              {saving ? (saveLabel || 'Saving…') : 'Save'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="btn-secondary flex-1 text-sm"
            >
              Save &amp; Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Location detail panel ─────────────────────────────────────────────────────

interface LocationPanelProps {
  location: SurveyLocation;
  siteId: number;
  onUpdate: (loc: SurveyLocation) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

function LocationPanel({ location, siteId, onUpdate, onDelete, onClose }: LocationPanelProps) {
  const [surveyNotes, setSurveyNotes] = useState(location.surveyNotes ?? '');
  const [cameras,     setCameras]     = useState(location.cameras);
  const [images,      setImages]      = useState(location.images);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const [assigning,   setAssigning]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const atLimit = images.length >= MAX_PHOTOS;
  const assignedCamera = cameras[0] ?? null;

  async function assignCamera(cameraId: number | null, cameraModelId?: number) {
    setAssigning(true);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId: cameraId ?? null, ...(cameraModelId ? { cameraModelId } : {}) }),
      });
      if (res.ok) {
        const updated: SurveyLocation = await res.json();
        setCameras(updated.cameras);
        onUpdate({ ...updated, images });
      }
    } finally {
      setAssigning(false);
    }
  }

  async function deletePhoto(photoId: number) {
    setDeletingId(photoId);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}/photos/${photoId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const updated = images.filter(img => img.id !== photoId);
        setImages(updated);
        onUpdate({ ...location, surveyNotes, cameras, images: updated });
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyNotes, markSurveyed: true }),
      });
      const updated = await res.json();
      onUpdate({ ...updated, images, cameras });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function deleteLocation() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(location.id);
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || atLimit) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`/api/survey/locations/${location.id}/photos`, {
        method: 'POST',
        body: fd,
      });
      if (res.ok) {
        const newImg = await res.json();
        const updated = [...images, newImg];
        setImages(updated);
        onUpdate({ ...location, surveyNotes, cameras, images: updated, surveyedAt: new Date().toISOString() });
      }
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal card */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{location.areaName}</h3>
            {location.floor && <p className="text-xs text-gray-500 mt-0.5">Floor {location.floor}</p>}
          </div>
          <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600 shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status row */}
          <div className="flex items-center gap-2">
            {statusChip({ ...location, cameras, images })}
          </div>

          {/* Camera assignment */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              Assigned Camera
            </label>
            <CameraPicker
              siteId={siteId}
              assignedCamera={assignedCamera}
              onAssign={assignCamera}
              assigning={assigning}
            />
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Photos
                <span className={`ml-1.5 font-normal ${atLimit ? 'text-amber-500' : 'text-gray-400'}`}>
                  ({images.length}/{MAX_PHOTOS})
                </span>
              </span>
              {!atLimit && (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline disabled:opacity-40"
                >
                  <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading…' : 'Add Photo'}
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={uploadPhoto}
              />
            </div>

            {images.length === 0 ? (
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                <PhotoIcon className="w-7 h-7" />
                <span className="text-xs">Tap to add a photo (up to {MAX_PHOTOS})</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map(img => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                    <img src={img.imageUrl} alt={img.caption ?? ''} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => deletePhoto(img.id)}
                      disabled={deletingId === img.id}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center disabled:opacity-40"
                      title="Delete photo"
                    >
                      {deletingId === img.id
                        ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        : <XMarkIcon className="w-3.5 h-3.5 text-white" />}
                    </button>
                  </div>
                ))}
                {!atLimit && (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-40"
                  >
                    <PlusIcon className="w-5 h-5" />
                    <span className="text-xs">{uploading ? '…' : 'Add'}</span>
                  </button>
                )}
                {atLimit && (
                  <div className="aspect-square rounded-xl border-2 border-amber-200 bg-amber-50 flex flex-col items-center justify-center gap-1 text-amber-500">
                    <span className="text-lg font-bold">5</span>
                    <span className="text-xs text-center leading-tight px-1">Max photos</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Survey Notes
            </label>
            <textarea
              value={surveyNotes}
              onChange={e => setSurveyNotes(e.target.value)}
              rows={4}
              placeholder="Observations, mounting type, obstructions, lighting conditions…"
              className="input-field text-sm w-full resize-none"
            />
          </div>

          {/* Save button */}
          <button
            onClick={saveNotes}
            disabled={saving || deleting}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2"
          >
            <CheckCircleIcon className="w-4 h-4" />
            {saving ? 'Saving…' : 'Mark Surveyed & Save'}
          </button>

          {/* Delete — two-tap confirm */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
            >
              Delete this location
            </button>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="flex-1 text-xs text-red-700 font-medium">Delete permanently?</p>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={deleteLocation}
                disabled={deleting}
                className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
              >
                {deleting && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Building accordion ────────────────────────────────────────────────────────

interface BuildingRowProps {
  building: SurveyBuilding;
  siteId: number;
  filter: Filter;
  onLocationUpdate: (loc: SurveyLocation) => void;
  onLocationAdd: (loc: SurveyLocation) => void;
  onLocationDelete: (id: number) => void;
  initialOpen: boolean;
}

function BuildingAccordion({ building, siteId, filter, onLocationUpdate, onLocationAdd, onLocationDelete, initialOpen }: BuildingRowProps) {
  const [open, setOpen] = useState(initialOpen);
  const [addingHere, setAddingHere] = useState(false);
  const [detailLoc, setDetailLoc] = useState<SurveyLocation | null>(null);
  const [showFloorPlans, setShowFloorPlans] = useState(false);

  const visibleLocs = building.locations.filter(l => {
    if (filter === 'done') return isDone(l);
    if (filter === 'pending') return !isDone(l);
    return true;
  });

  const doneCount = building.locations.filter(isDone).length;
  const total = building.locations.length;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 hover:bg-gray-50 transition-colors">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-3 py-3 text-left"
        >
          {open ? <ChevronDownIcon className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />}
          <span className="font-medium text-gray-900 flex-1 text-sm">{building.buildingName}</span>
          <span className="text-xs text-gray-500 mr-1">{doneCount}/{total}</span>
          {doneCount === total && total > 0 && <CheckCircleSolid className="w-4 h-4 text-green-500" />}
        </button>
        {/* Floor plans toggle */}
        <div className="relative ml-2">
          <button
            onClick={() => setShowFloorPlans(s => !s)}
            title="Floor plans"
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
              building.floorPlans.length > 0
                ? 'text-blue-500 hover:bg-blue-50'
                : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
            }`}
          >
            <DocumentIcon className="w-3.5 h-3.5" />
            {building.floorPlans.length > 0 && (
              <span className="font-medium">{building.floorPlans.length}</span>
            )}
          </button>
          {showFloorPlans && (
            <div className="absolute right-0 top-8 z-30 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Floor Plans</p>
              {building.floorPlans.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No floor plans uploaded yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {building.floorPlans.map(fp => (
                    <li key={fp.id} className="flex items-center gap-2">
                      <DocumentIcon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-xs text-gray-700 flex-1 truncate">
                        Floor {fp.floor}
                        {fp.originalFileName && (
                          <span className="text-gray-400"> — {fp.originalFileName}</span>
                        )}
                      </span>
                      {fp.fileUrl && (
                        <a
                          href={fp.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:text-blue-700 shrink-0"
                          title="Open PDF"
                        >
                          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => setShowFloorPlans(false)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-right"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100">
          {/* Progress bar */}
          {total > 0 && (
            <div className="h-1 bg-gray-100">
              <div
                className="h-1 bg-green-500 transition-all"
                style={{ width: `${(doneCount / total) * 100}%` }}
              />
            </div>
          )}

          {/* Locations */}
          {visibleLocs.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400 italic">No locations match this filter.</p>
          )}
          {visibleLocs.map(loc => (
            <button
              key={loc.id}
              onClick={() => setDetailLoc(loc)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left group"
            >
              {isDone(loc)
                ? <CheckCircleSolid className="w-4 h-4 text-green-500 shrink-0" />
                : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0 group-hover:border-blue-400 transition-colors" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loc.areaName}</p>
                {loc.floor && <p className="text-xs text-gray-400">Floor {loc.floor}</p>}
                {loc.cameras[0] && (
                  <p className="text-xs text-blue-500 truncate mt-0.5 flex items-center gap-1">
                    <CameraIcon className="w-3 h-3 inline shrink-0" />
                    {cameraLabel(loc.cameras[0])}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {loc.images.length > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <PhotoIcon className="w-3 h-3" />
                    {loc.images.length}
                  </span>
                )}
                <PencilIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
              </div>
            </button>
          ))}

          {/* Add location button */}
          <button
            onClick={() => setAddingHere(true)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Add location
          </button>
        </div>
      )}

      {/* Modals */}
      {addingHere && (
        <QuickAddSheet
          buildings={[building]}
          defaultBuildingId={building.id}
          onSave={loc => { onLocationAdd(loc); setAddingHere(false); }}
          onClose={() => setAddingHere(false)}
        />
      )}
      {detailLoc && (
        <LocationPanel
          location={detailLoc}
          siteId={siteId}
          onUpdate={updated => { onLocationUpdate(updated); setDetailLoc(updated); }}
          onDelete={id => { onLocationDelete(id); setDetailLoc(null); }}
          onClose={() => setDetailLoc(null)}
        />
      )}
    </div>
  );
}

// ── Main SurveyBoard ──────────────────────────────────────────────────────────

interface Props {
  initialSite: SurveySite;
}

export function SurveyBoard({ initialSite }: Props) {
  const [site, setSite] = useState<SurveySite>(initialSite);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);

  // Register "add location" voice command while this board is mounted
  const { registerCommands } = useVoice();
  useEffect(() => {
    const unregister = registerCommands('survey-board', [
      {
        keywords: ['add location', 'new location'],
        action: () => setShowAdd(true),
      },
    ]);
    return unregister;
  }, [registerCommands]);

  const allLocations = site.buildings.flatMap(b => b.locations);
  const doneCount = allLocations.filter(isDone).length;
  const total = allLocations.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const handleLocationUpdate = useCallback((updated: SurveyLocation) => {
    setSite(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        locations: b.locations.map(l => l.id === updated.id ? updated : l),
      })),
    }));
  }, []);

  const handleLocationAdd = useCallback((newLoc: SurveyLocation) => {
    setSite(prev => ({
      ...prev,
      buildings: prev.buildings.map(b =>
        b.id === newLoc.buildingId
          ? { ...b, locations: [...b.locations, newLoc] }
          : b
      ) as SurveyBuilding[],
    }));
  }, []);

  const handleLocationDelete = useCallback((deletedId: number) => {
    setSite(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        locations: b.locations.filter(l => l.id !== deletedId),
      })),
    }));
  }, []);

  return (
    <div className="relative min-h-screen pb-24">
      {/* Progress header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Survey Progress</p>
            <p className="text-2xl font-bold text-gray-900">{pct}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{doneCount} / {total}</p>
            <p className="text-xs text-gray-400">locations surveyed</p>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-2 bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'done'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Buildings */}
      <div className="space-y-3">
        {site.buildings.map((b, i) => (
          <BuildingAccordion
            key={b.id}
            building={b}
            siteId={site.id}
            filter={filter}
            onLocationUpdate={handleLocationUpdate}
            onLocationAdd={handleLocationAdd}
            onLocationDelete={handleLocationDelete}
            initialOpen={i === 0}
          />
        ))}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors text-sm font-medium z-40"
      >
        <PlusIcon className="w-5 h-5" />
        Add Location
      </button>

      {showAdd && (
        <QuickAddSheet
          buildings={site.buildings}
          onSave={loc => { handleLocationAdd(loc); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
