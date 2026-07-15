'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CameraIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  PhotoIcon,
  XMarkIcon,
  MicrophoneIcon,
  DocumentIcon,
  ArrowTopRightOnSquareIcon,
  Squares2X2Icon,
  MagnifyingGlassIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { useVoice, useWaitForValue } from '@/context/VoiceContext';
import { PhotoLightbox } from '@/components/survey/PhotoLightbox';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SurveyImage {
  id: number;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}

export interface GeneralItemOption {
  id:          number;
  name:        string;
  description: string | null;
  cost:        string | number;
  defaultQty:  string | number;
}

export interface AssignedItem {
  generalItemId: number;
  name:          string;
  quantity:      number;
}

interface GeneralLocation {
  id:          number;
  projectId:   number | null;
  areaName:    string | null;
  floor:       string | null;
  surveyNotes: string | null;
  surveyedAt:  string | null;
  items:       AssignedItem[];
  images:      SurveyImage[];
}

interface SurveyFloorPlan {
  id:               number;
  floor:            string;
  originalFileName: string | null;
  fileUrl:          string | null;
}

interface SurveyBuilding {
  id:           number;
  buildingName: string;
  siteName:     string | null;
  floorPlans:   SurveyFloorPlan[];
}

interface GeneralSurveyProject {
  id:          number;
  projectName: string;
  building:    SurveyBuilding | null;
  locations:   GeneralLocation[];
}

type Filter = 'all' | 'pending' | 'done';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDone(loc: GeneralLocation) { return !!loc.surveyedAt; }

function statusChip(loc: GeneralLocation) {
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

// ── Multi-item editor ─────────────────────────────────────────────────────────

function ItemsEditor({
  assigned,
  options,
  loading,
  onChange,
  saving,
}: {
  assigned: AssignedItem[];
  options:  GeneralItemOption[];
  loading:  boolean;
  onChange: (items: AssignedItem[]) => void;
  saving?:  boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch]         = useState('');

  const available = options.filter(o =>
    !assigned.some(a => a.generalItemId === o.id) &&
    (!search || o.name.toLowerCase().includes(search.toLowerCase()) ||
     (o.description ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  function addItem(opt: GeneralItemOption) {
    onChange([...assigned, { generalItemId: opt.id, name: opt.name, quantity: Number(opt.defaultQty) || 1 }]);
    setPickerOpen(false);
    setSearch('');
  }

  function setQty(id: number, qty: number) {
    onChange(assigned.map(a => a.generalItemId === id ? { ...a, quantity: Math.max(0.01, qty) } : a));
  }

  function remove(id: number) {
    onChange(assigned.filter(a => a.generalItemId !== id));
  }

  return (
    <div>
      {assigned.length === 0 ? (
        <p className="text-xs text-gray-400 italic mb-2">No items assigned yet.</p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {assigned.map(a => (
            <div key={a.generalItemId} className="flex items-center gap-2 px-3 py-2 bg-indigo-50/60 border border-indigo-100 rounded-lg">
              <Squares2X2Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="flex-1 text-xs font-medium text-gray-800 truncate">{a.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => setQty(a.generalItemId, a.quantity - 1)}
                  disabled={a.quantity <= 1}
                  className="w-5 h-5 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-indigo-600 disabled:opacity-30">
                  <MinusIcon className="w-3 h-3" />
                </button>
                <input
                  type="number" min="0.01" step="1" value={a.quantity}
                  onChange={e => setQty(a.generalItemId, Number(e.target.value) || 1)}
                  className="w-12 text-center text-xs border border-gray-200 rounded py-0.5"
                />
                <button type="button" onClick={() => setQty(a.generalItemId, a.quantity + 1)}
                  className="w-5 h-5 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-indigo-600">
                  <PlusIcon className="w-3 h-3" />
                </button>
              </div>
              <button type="button" onClick={() => remove(a.generalItemId)}
                className="text-gray-300 hover:text-red-500 shrink-0">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <button type="button" onClick={() => setPickerOpen(o => !o)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50">
          <PlusIcon className="w-3.5 h-3.5" />
          {loading ? 'Loading items…' : 'Add item…'}
          {saving && <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin ml-1" />}
        </button>

        {pickerOpen && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto min-w-64">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search items…"
                  className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400" />
              </div>
            </div>
            {available.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400 italic">
                {options.length === 0 ? 'No catalog items — add some under Settings → General Items.' : 'No more items match.'}
              </p>
            ) : available.map(o => (
              <button key={o.id} type="button" onClick={() => addItem(o)}
                className="w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{o.name}</p>
                  {o.description && <p className="text-xs text-gray-400 truncate">{o.description}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {Number(o.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add location modal ────────────────────────────────────────────────────────

const MAX_PHOTOS = 5;

interface QuickAddProps {
  projectId:    number;
  itemOptions:  GeneralItemOption[];
  itemsLoading: boolean;
  onSave:       (loc: GeneralLocation) => void;
  onClose:      () => void;
}

interface PendingPhoto { file: File; preview: string; }

function GeneralQuickAddSheet({ projectId, itemOptions, itemsLoading, onSave, onClose }: QuickAddProps) {
  const [areaName,    setAreaName]    = useState('');
  const [floor,       setFloor]       = useState('');
  const [surveyNotes, setSurveyNotes] = useState('');
  const [pending,     setPending]     = useState<PendingPhoto[]>([]);
  const [pendingItems, setPendingItems] = useState<AssignedItem[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [saveLabel,   setSaveLabel]   = useState('');
  const [voiceField,  setVoiceField]  = useState<string | null>(null);
  const [photoPrompted, setPhotoPrompted] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);
  const areaRef    = useRef<HTMLInputElement>(null);
  const photoRef   = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const atLimit = pending.length >= MAX_PHOTOS;

  const { registerCommands, mode, activeField, speak } = useVoice();
  const waitForValue = useWaitForValue();

  useEffect(() => {
    const unregister = registerCommands('general-quick-add', [
      { keywords: ['name'],  action: () => { setVoiceField('areaName'); waitForValue('Name',  (val) => { setAreaName(val); setVoiceField(null); }, { promptText: 'What is the name?', captureText: (v) => `Name set to ${v}.` }); } },
      { keywords: ['floor'], action: () => { setVoiceField('floor');    waitForValue('Floor', (val) => { setFloor(val);    setVoiceField(null); }, { promptText: 'Which floor?',       captureText: (v) => `Floor set to ${v}.` }); } },
      { keywords: ['notes', 'note'], action: () => { setVoiceField('notes'); waitForValue('Notes', (val) => { setSurveyNotes(val); setVoiceField(null); }, { promptText: 'Go ahead with your notes.', captureText: 'Notes saved.' }); } },
      { keywords: ['photo'], action: () => { if (atLimit) { speak('Photo limit reached. Five photos maximum.'); } else { speak('Ready for photo.'); setPhotoPrompted(true); } } },
      { keywords: ['save'],  action: () => { handleSave(false); } },
      { keywords: ['next'],  action: () => { handleSave(true);  } },
      { keywords: ['exit', 'cancel', 'close'], action: () => { speak('Closing.'); onClose(); } },
    ]);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCommands, speak, atLimit]);

  function voicePulse(field: string) {
    return voiceField === field || (mode === 'waitingForValue' && activeField?.toLowerCase() === field.toLowerCase())
      ? 'ring-2 ring-amber-400 ring-offset-1' : '';
  }

  function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const slots = MAX_PHOTOS - pending.length;
    setPending(prev => [...prev, ...files.slice(0, slots).map(file => ({ file, preview: URL.createObjectURL(file) }))]);
    if (photoRef.current)   photoRef.current.value = '';
    if (libraryRef.current) libraryRef.current.value = '';
  }

  function removePhoto(idx: number) {
    setPending(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx); });
  }

  async function handleSave(andNext = false) {
    if (!areaName.trim()) { speak('Please say a name first'); areaRef.current?.focus(); return; }
    setSaving(true);
    try {
      setSaveLabel('Creating location…');
      const res = await fetch('/api/survey/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          areaName:    areaName.trim(),
          floor:       floor.trim() || null,
          surveyNotes: surveyNotes.trim() || null,
        }),
      });
      const loc = await res.json();

      let savedItems: AssignedItem[] = [];
      if (pendingItems.length > 0) {
        setSaveLabel('Assigning items…');
        const ir = await fetch(`/api/survey/locations/${loc.id}/general-items`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ items: pendingItems.map(i => ({ generalItemId: i.generalItemId, quantity: i.quantity })) }),
        });
        if (ir.ok) {
          const d = await ir.json();
          savedItems = (d.items ?? []) as AssignedItem[];
        }
      }

      const uploaded: SurveyImage[] = [];
      for (let i = 0; i < pending.length; i++) {
        setSaveLabel(`Uploading photo ${i + 1} of ${pending.length}…`);
        const fd = new FormData(); fd.append('photo', pending[i].file);
        const pr = await fetch(`/api/survey/locations/${loc.id}/photos`, { method: 'POST', body: fd });
        if (pr.ok) uploaded.push(await pr.json());
      }
      pending.forEach(p => URL.revokeObjectURL(p.preview));
      onSave({ ...loc, items: savedItems, images: uploaded });

      if (andNext) {
        speak('Saved. Ready for next location.');
        setAreaName(''); setFloor(''); setSurveyNotes(''); setPending([]); setSaveLabel('');
        setPendingItems([]);
        setTimeout(() => areaRef.current?.focus(), 50);
      } else {
        speak('Location saved.'); onClose();
      }
    } finally { setSaving(false); setSaveLabel(''); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Location</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Area name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Area / Location Name <span className="text-red-500">*</span></label>
            <input ref={areaRef} autoFocus value={areaName} onChange={e => setAreaName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(true); }}
              placeholder="e.g. Conference Room, IDF Closet"
              className={`input-field text-sm w-full ${voicePulse('areaName')}`} />
          </div>

          {/* Floor */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Floor</label>
            <input value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. 1, 2, Basement"
              className={`input-field text-sm w-full ${voicePulse('floor')}`} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={surveyNotes} onChange={e => setSurveyNotes(e.target.value)} rows={2}
              placeholder="Conditions, access, cable path…"
              className={`input-field text-sm w-full resize-none ${voicePulse('notes')}`} />
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</label>
            <ItemsEditor
              assigned={pendingItems}
              options={itemOptions}
              loading={itemsLoading}
              onChange={setPendingItems}
            />
          </div>

          {/* Voice hint */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <MicrophoneIcon className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-400">Say: <strong className="text-gray-600">Name · Floor · Notes · Photo · Save · Next · Exit</strong></span>
          </div>

          {/* Photos */}
          <div>
            <input ref={photoRef}   type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addPhoto(e); setPhotoPrompted(false); }} />
            <input ref={libraryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhoto(e); setPhotoPrompted(false); }} />
            <div className="flex items-center mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Photos<span className={`ml-1.5 font-normal ${atLimit ? 'text-amber-500' : 'text-gray-400'}`}>({pending.length}/{MAX_PHOTOS})</span></span>
            </div>
            {photoPrompted && !atLimit && (
              <button type="button" onClick={() => { photoRef.current?.click(); setPhotoPrompted(false); }}
                className="w-full mb-2 py-3 rounded-xl bg-amber-50 border-2 border-amber-400 flex items-center justify-center gap-2 text-amber-700 font-semibold text-sm animate-pulse">
                <PhotoIcon className="w-5 h-5" />Tap here to capture photo
              </button>
            )}
            {pending.length === 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => photoRef.current?.click()} className="h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                  <CameraIcon className="w-5 h-5" /><span className="text-xs">Take Photo</span>
                </button>
                <button type="button" onClick={() => libraryRef.current?.click()} className="h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                  <PhotoIcon className="w-5 h-5" /><span className="text-xs">From Library</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {pending.map((p, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-sm">
                    <img src={p.preview} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setExpandedPreview(p.preview)} />
                    <button type="button" onClick={() => removePhoto(idx)} className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center">
                      <XMarkIcon className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {expandedPreview && <PhotoLightbox src={expandedPreview} alt="" onClose={() => setExpandedPreview(null)} />}
                {!atLimit && (
                  <div className="aspect-square rounded-lg border-2 border-dashed border-gray-200 grid grid-rows-2 overflow-hidden">
                    <button type="button" onClick={() => photoRef.current?.click()} className="flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors border-b border-gray-200" title="Take Photo"><CameraIcon className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => libraryRef.current?.click()} className="flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors" title="From Library"><PhotoIcon className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                {atLimit && <div className="aspect-square rounded-lg border-2 border-amber-200 bg-amber-50 flex flex-col items-center justify-center text-amber-500"><span className="text-sm font-bold">5</span><span className="text-xs">Max</span></div>}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-primary flex-1 text-sm">{saving ? (saveLabel || 'Saving…') : 'Save'}</button>
            <button onClick={() => handleSave(true)}  disabled={saving} className="btn-secondary flex-1 text-sm">Save &amp; Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Location detail panel ─────────────────────────────────────────────────────

interface LocationPanelProps {
  location:     GeneralLocation;
  itemOptions:  GeneralItemOption[];
  itemsLoading: boolean;
  onUpdate:     (loc: GeneralLocation) => void;
  onDelete:     (id: number) => void;
  onClose:      () => void;
}

function GeneralLocationPanel({ location, itemOptions, itemsLoading, onUpdate, onDelete, onClose }: LocationPanelProps) {
  const [surveyNotes,   setSurveyNotes]   = useState(location.surveyNotes ?? '');
  const [items,         setItems]         = useState<AssignedItem[]>(location.items);
  const [images,        setImages]        = useState(location.images);
  const [saving,        setSaving]        = useState(false);
  const [savingItems,   setSavingItems]   = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [deletingId,    setDeletingId]    = useState<number | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<{ src: string; alt: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [editMode,      setEditMode]      = useState(false);
  const [editAreaName,  setEditAreaName]  = useState(location.areaName ?? '');
  const [editFloor,     setEditFloor]     = useState(location.floor ?? '');
  const [savingEdits,   setSavingEdits]   = useState(false);
  const photoInputRef   = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const { registerCommands, speak } = useVoice();

  useEffect(() => {
    const unregister = registerCommands('general-location-panel', [
      { keywords: ['save', 'mark surveyed'], action: () => { saveNotes(); } },
      { keywords: ['photo'], action: () => { if (images.length >= MAX_PHOTOS) { speak('Photo limit reached.'); } else { speak('Tap the screen to add a photo'); photoInputRef.current?.click(); } } },
      { keywords: ['close', 'back', 'exit'], action: () => { speak('Closing'); onClose(); } },
    ]);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCommands, speak, images.length]);

  const atLimit = images.length >= MAX_PHOTOS;

  // Items persist immediately on every change
  async function changeItems(next: AssignedItem[]) {
    setItems(next);
    setSavingItems(true);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}/general-items`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items: next.map(i => ({ generalItemId: i.generalItemId, quantity: i.quantity })) }),
      });
      if (res.ok) {
        const d = await res.json();
        const saved = (d.items ?? []) as AssignedItem[];
        setItems(saved);
        onUpdate({ ...location, surveyNotes, items: saved, images });
      }
    } finally { setSavingItems(false); }
  }

  async function deletePhoto(photoId: number) {
    setDeletingId(photoId);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}/photos/${photoId}`, { method: 'DELETE' });
      if (res.ok) { const updated = images.filter(img => img.id !== photoId); setImages(updated); onUpdate({ ...location, surveyNotes, items, images: updated }); }
    } finally { setDeletingId(null); }
  }

  async function saveDetails() {
    setSavingEdits(true);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ areaName: editAreaName.trim() || location.areaName, floor: editFloor.trim() || null }) });
      if (res.ok) { const updated = await res.json(); onUpdate({ ...updated, images, items }); setEditMode(false); }
    } finally { setSavingEdits(false); }
  }

  async function saveNotes() {
    speak('Saving'); setSaving(true);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surveyNotes, markSurveyed: true }) });
      const updated = await res.json(); onUpdate({ ...updated, images, items });
      speak(`${location.areaName} marked as surveyed`); onClose();
    } finally { setSaving(false); }
  }

  async function deleteLocation() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/survey/locations/${location.id}`, { method: 'DELETE' });
      if (res.ok) { onDelete(location.id); onClose(); }
    } finally { setDeleting(false); }
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || atLimit) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('photo', file);
      const res = await fetch(`/api/survey/locations/${location.id}/photos`, { method: 'POST', body: fd });
      if (res.ok) {
        const newImg = await res.json(); const updated = [...images, newImg]; setImages(updated);
        onUpdate({ ...location, surveyNotes, items, images: updated, surveyedAt: new Date().toISOString() });
        speak(`Photo added. ${updated.length} of ${MAX_PHOTOS}.`);
      }
    } finally { setUploading(false); if (photoInputRef.current) photoInputRef.current.value = ''; }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          {editMode ? (
            <div className="flex-1 space-y-2 mr-3">
              <input value={editAreaName} onChange={e => setEditAreaName(e.target.value)} placeholder="Area name" className="input-field text-sm w-full" />
              <input value={editFloor}    onChange={e => setEditFloor(e.target.value)}    placeholder="Floor (optional)" className="input-field text-sm w-full" />
              <div className="flex gap-2 pt-1">
                <button onClick={saveDetails} disabled={savingEdits} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                  {savingEdits && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                  {savingEdits ? 'Saving…' : 'Save changes'}
                </button>
                <button onClick={() => { setEditMode(false); setEditAreaName(location.areaName ?? ''); setEditFloor(location.floor ?? ''); }} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 flex-1">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{location.areaName}</h3>
                {location.floor && <p className="text-xs text-gray-500 mt-0.5">Floor {location.floor}</p>}
              </div>
              <button onClick={() => setEditMode(true)} className="mt-0.5 text-gray-300 hover:text-blue-500 transition-colors" title="Edit name or floor">
                <PencilIcon className="w-4 h-4" />
              </button>
            </div>
          )}
          <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 shrink-0"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-2">{statusChip({ ...location, items, images })}</div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Items</label>
            <ItemsEditor
              assigned={items}
              options={itemOptions}
              loading={itemsLoading}
              onChange={changeItems}
              saving={savingItems}
            />
          </div>

          {/* Photos */}
          <div>
            <input ref={photoInputRef}   type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadPhoto} />
            <input ref={libraryInputRef} type="file" accept="image/*"                       className="hidden" onChange={uploadPhoto} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Photos<span className={`ml-1.5 font-normal ${atLimit ? 'text-amber-500' : 'text-gray-400'}`}>({images.length}/{MAX_PHOTOS})</span></span>
              {uploading && <span className="text-xs text-gray-400 flex items-center gap-1"><span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />Uploading…</span>}
            </div>
            {images.length === 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => photoInputRef.current?.click()} className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"><CameraIcon className="w-6 h-6" /><span className="text-xs">Take Photo</span></button>
                <button onClick={() => libraryInputRef.current?.click()} className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"><PhotoIcon className="w-6 h-6" /><span className="text-xs">From Library</span></button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map(img => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                    <img src={img.imageUrl} alt={img.caption ?? ''} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setExpandedPhoto({ src: img.imageUrl, alt: img.caption ?? '' })} />
                    <button type="button" onClick={() => deletePhoto(img.id)} disabled={deletingId === img.id} className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center disabled:opacity-40">
                      {deletingId === img.id ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <XMarkIcon className="w-3.5 h-3.5 text-white" />}
                    </button>
                  </div>
                ))}
                {expandedPhoto && <PhotoLightbox src={expandedPhoto.src} alt={expandedPhoto.alt} onClose={() => setExpandedPhoto(null)} />}
                {!atLimit && !uploading && (
                  <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 grid grid-rows-2 overflow-hidden">
                    <button onClick={() => photoInputRef.current?.click()} className="flex items-center justify-center gap-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors border-b border-gray-200"><CameraIcon className="w-4 h-4" /></button>
                    <button onClick={() => libraryInputRef.current?.click()} className="flex items-center justify-center gap-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"><PhotoIcon className="w-4 h-4" /></button>
                  </div>
                )}
                {uploading && <div className="aspect-square rounded-xl border-2 border-gray-200 bg-gray-50 flex items-center justify-center"><span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>}
                {atLimit && <div className="aspect-square rounded-xl border-2 border-amber-200 bg-amber-50 flex flex-col items-center justify-center gap-1 text-amber-500"><span className="text-lg font-bold">5</span><span className="text-xs text-center leading-tight px-1">Max photos</span></div>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Survey Notes</label>
            <textarea value={surveyNotes} onChange={e => setSurveyNotes(e.target.value)} rows={4} placeholder="Conditions, access, cable path…" className="input-field text-sm w-full resize-none" />
          </div>

          <button onClick={saveNotes} disabled={saving || deleting} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
            <CheckCircleIcon className="w-4 h-4" />{saving ? 'Saving…' : 'Mark Surveyed & Save'}
          </button>

          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} disabled={deleting} className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-1">Delete this location</button>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="flex-1 text-xs text-red-700 font-medium">Delete permanently?</p>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
              <button onClick={deleteLocation} disabled={deleting} className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40">
                {deleting && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Floor plan popover ────────────────────────────────────────────────────────

function FloorPlanPopover({ building }: { building: SurveyBuilding }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setShow(s => !s)} title="Floor plans"
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${building.floorPlans.length > 0 ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}`}>
        <DocumentIcon className="w-3.5 h-3.5" />
        {building.floorPlans.length > 0 && <span className="font-medium">{building.floorPlans.length}</span>}
      </button>
      {show && (
        <div className="absolute right-0 top-8 z-30 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Floor Plans</p>
          {building.floorPlans.length === 0
            ? <p className="text-xs text-gray-400 italic">No floor plans uploaded yet.</p>
            : <ul className="space-y-1.5">{building.floorPlans.map(fp => (
                <li key={fp.id} className="flex items-center gap-2">
                  <DocumentIcon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs text-gray-700 flex-1 truncate">Floor {fp.floor}{fp.originalFileName && <span className="text-gray-400"> — {fp.originalFileName}</span>}</span>
                  {fp.fileUrl && <a href={fp.fileUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 shrink-0"><ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" /></a>}
                </li>))}
              </ul>}
          <button onClick={() => setShow(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-right">Close</button>
        </div>
      )}
    </div>
  );
}

// ── Main GeneralSurveyBoard ───────────────────────────────────────────────────

const PAGE_SIZE = 6;

interface Props { initialProject: GeneralSurveyProject; }

export function GeneralSurveyBoard({ initialProject }: Props) {
  const [project,   setProject]   = useState<GeneralSurveyProject>(initialProject);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [showAdd,   setShowAdd]   = useState(false);
  const [detailLoc, setDetailLoc] = useState<GeneralLocation | null>(null);
  const [page,      setPage]      = useState(0);

  const [itemOptions, setItemOptions]   = useState<GeneralItemOption[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/general-items')
      .then(r => r.json())
      .then((d: GeneralItemOption[]) => setItemOptions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setItemsLoading(false));
  }, []);

  const { registerCommands } = useVoice();
  useEffect(() => {
    const unregister = registerCommands('general-survey-board', [{ keywords: ['add location', 'new location'], ack: 'Adding new location.', action: () => { setShowAdd(true); } }]);
    return unregister;
  }, [registerCommands]);

  const visibleLocs = project.locations.filter(l => {
    if (filter === 'done')    return isDone(l);
    if (filter === 'pending') return !isDone(l);
    return true;
  });

  const pageCount = Math.ceil(visibleLocs.length / PAGE_SIZE);
  const safePage  = Math.min(page, Math.max(0, pageCount - 1));
  const pageLocs  = visibleLocs.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const doneCount = project.locations.filter(isDone).length;
  const total     = project.locations.length;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const handleLocationUpdate = useCallback((updated: GeneralLocation) => {
    setProject(prev => ({ ...prev, locations: prev.locations.map(l => l.id === updated.id ? updated : l) }));
  }, []);

  const handleLocationAdd = useCallback((newLoc: GeneralLocation) => {
    setProject(prev => ({ ...prev, locations: [...prev.locations, newLoc] }));
  }, []);

  const handleLocationDelete = useCallback((deletedId: number) => {
    setProject(prev => ({ ...prev, locations: prev.locations.filter(l => l.id !== deletedId) }));
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {project.building && (
            <p className="text-sm text-gray-500">
              {project.building.buildingName}
              {project.building.siteName && <> · {project.building.siteName}</>}
            </p>
          )}
          <p className="text-xs text-gray-400">{total} location{total !== 1 ? 's' : ''} · {doneCount} surveyed</p>
        </div>
        <div className="flex items-center gap-3">
          {project.building && <FloorPlanPopover building={project.building} />}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{pct}%</span>
            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'done'] as Filter[]).map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Surveyed'}
          </button>
        ))}
      </div>

      {/* Locations list */}
      <div className="card overflow-hidden mb-4">
        {visibleLocs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 italic text-center">
            {filter === 'all' ? 'No locations yet — add one below.' : 'No locations match this filter.'}
          </p>
        ) : (
          <>
            {pageLocs.map(loc => (
              <button key={loc.id} onClick={() => setDetailLoc(loc)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left group">
                {isDone(loc)
                  ? <CheckCircleSolid className="w-4 h-4 text-green-500 shrink-0" />
                  : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0 group-hover:border-blue-400 transition-colors" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{loc.areaName}</p>
                  {loc.floor && <p className="text-xs text-gray-400">Floor {loc.floor}</p>}
                  {loc.items.length > 0 && (
                    <p className="text-xs text-indigo-500 truncate mt-0.5 flex items-center gap-1">
                      <Squares2X2Icon className="w-3 h-3 inline shrink-0" />
                      {loc.items.map(i => `${Number(i.quantity)}× ${i.name}`).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {loc.images.length > 0 && <span className="flex items-center gap-0.5 text-xs text-gray-400"><PhotoIcon className="w-3 h-3" />{loc.images.length}</span>}
                  <PencilIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
            ))}

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50/60">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeftIcon className="w-3.5 h-3.5" />Prev
                </button>
                <span className="text-xs text-gray-400">{safePage + 1} / {pageCount} <span className="text-gray-300">({visibleLocs.length} locations)</span></span>
                <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage === pageCount - 1} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Next<ChevronRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
          <PlusIcon className="w-5 h-5" />Add Location
        </button>
      </div>

      {showAdd && (
        <GeneralQuickAddSheet
          projectId={project.id}
          itemOptions={itemOptions}
          itemsLoading={itemsLoading}
          onSave={loc => { handleLocationAdd(loc); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {detailLoc && (
        <GeneralLocationPanel
          location={detailLoc}
          itemOptions={itemOptions}
          itemsLoading={itemsLoading}
          onUpdate={updated => { handleLocationUpdate(updated); setDetailLoc(updated); }}
          onDelete={id => { handleLocationDelete(id); setDetailLoc(null); }}
          onClose={() => setDetailLoc(null)}
        />
      )}
    </div>
  );
}
