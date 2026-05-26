'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PhotoIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon,
  DocumentIcon, XMarkIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

type ImageType =
  | 'Site Survey' | 'Mounting Location' | 'Field of View'
  | 'Cable Path' | 'Installed Camera' | 'Maintenance' | 'Other';

interface CameraImage {
  id: number;
  imageType: ImageType;
  fileName: string;
  originalFileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  description: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
}

interface Props {
  cameraId: number;
  initialImages: CameraImage[];
}

const IMAGE_TYPES: ImageType[] = [
  'Site Survey', 'Mounting Location', 'Field of View',
  'Cable Path', 'Installed Camera', 'Maintenance', 'Other',
];

function fmtBytes(n: number | null) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_COLORS: Record<string, string> = {
  'Site Survey':       'bg-purple-50 text-purple-700',
  'Mounting Location': 'bg-blue-50 text-blue-700',
  'Field of View':     'bg-cyan-50 text-cyan-700',
  'Cable Path':        'bg-amber-50 text-amber-700',
  'Installed Camera':  'bg-green-50 text-green-700',
  'Maintenance':       'bg-red-50 text-red-700',
  'Other':             'bg-gray-100 text-gray-600',
};

export function CameraImageGallery({ cameraId, initialImages }: Props) {
  const router = useRouter();
  const [images, setImages] = useState<CameraImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState<CameraImage | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [newType, setNewType] = useState<ImageType>('Other');
  const [newDesc, setNewDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setUploadError('');
    if (!['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type)) {
      setUploadError('Only JPG, PNG, or PDF files are allowed.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds the 25 MB limit.');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const submitUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('imageType', newType);
      fd.append('description', newDesc);

      const res = await fetch(`/api/cameras/${cameraId}/images`, { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json();
        setUploadError(j.error || 'Upload failed.');
        return;
      }
      const img = await res.json();
      setImages(prev => [img, ...prev]);
      setShowUpload(false);
      setSelectedFile(null);
      setNewType('Other');
      setNewDesc('');
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (id: number) => {
    const res = await fetch(`/api/camera-images/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setImages(prev => prev.filter(i => i.id !== id));
      setDeleteConfirm(null);
      if (lightbox?.id === id) setLightbox(null);
    }
  };

  const isPdf = (img: CameraImage) => img.mimeType === 'application/pdf';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <PhotoIcon className="w-4 h-4" />
          Images &amp; Documents
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {images.length}
          </span>
        </h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="btn-primary text-xs flex items-center gap-1.5"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Upload
        </button>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Image Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as ImageType)}
                className="input-field text-sm"
              >
                {IMAGE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Brief description…"
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                <CheckIcon className="w-5 h-5" />
                <span className="font-medium">{selectedFile.name}</span>
                <span className="text-gray-500">({fmtBytes(selectedFile.size)})</span>
              </div>
            ) : (
              <div>
                <PhotoIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Drag & drop or click to select</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · max 25 MB</p>
              </div>
            )}
          </div>

          {uploadError && (
            <p className="text-xs text-red-600 mt-2">{uploadError}</p>
          )}

          <div className="flex gap-2 mt-3 justify-end">
            <button
              onClick={() => { setShowUpload(false); setSelectedFile(null); setUploadError(''); }}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              onClick={submitUpload}
              disabled={!selectedFile || uploading}
              className="btn-primary text-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {uploading ? 'Uploading…' : 'Upload File'}
            </button>
          </div>
        </div>
      )}

      {/* Gallery grid */}
      {images.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <PhotoIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No images uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => (
            <div key={img.id} className="group relative card overflow-hidden p-0">
              {/* Thumbnail */}
              <div
                className="relative h-32 bg-gray-100 cursor-pointer overflow-hidden"
                onClick={() => setLightbox(img)}
              >
                {isPdf(img) ? (
                  <div className="h-full flex flex-col items-center justify-center gap-1 text-gray-500">
                    <DocumentIcon className="w-10 h-10" />
                    <span className="text-xs font-medium">PDF</span>
                  </div>
                ) : (
                  <img
                    src={img.fileUrl ?? ''}
                    alt={img.originalFileName ?? img.fileName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
                {/* Delete overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-start justify-end p-1.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(img.id); }}
                    className="w-6 h-6 bg-red-600 text-white rounded flex items-center justify-center hover:bg-red-700"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-2">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[img.imageType] || TYPE_COLORS['Other']}`}>
                  {img.imageType}
                </span>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {img.originalFileName ?? img.fileName}
                </p>
                <p className="text-xs text-gray-400">
                  {format(new Date(img.uploadedAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 mb-2">Delete image?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will permanently remove the file. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => deleteImage(deleteConfirm)}
                className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            {/* Controls */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[lightbox.imageType] || TYPE_COLORS['Other']}`}>
                  {lightbox.imageType}
                </span>
                {lightbox.description && (
                  <span className="ml-2 text-white/80 text-sm">{lightbox.description}</span>
                )}
              </div>
              <div className="flex gap-2">
                {lightbox.fileUrl && (
                  <a
                    href={lightbox.fileUrl}
                    download={lightbox.originalFileName ?? lightbox.fileName}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center text-white"
                    onClick={e => e.stopPropagation()}
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setLightbox(null)}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center text-white"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            {isPdf(lightbox) ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <DocumentIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="font-medium text-gray-900 mb-1">{lightbox.originalFileName ?? lightbox.fileName}</p>
                <p className="text-sm text-gray-500 mb-4">{fmtBytes(lightbox.fileSizeBytes)}</p>
                <a
                  href={lightbox.fileUrl ?? '#'}
                  download
                  className="btn-primary text-sm inline-flex items-center gap-1.5"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" /> Download PDF
                </a>
              </div>
            ) : (
              <img
                src={lightbox.fileUrl ?? ''}
                alt={lightbox.originalFileName ?? lightbox.fileName}
                className="max-h-[70vh] w-full object-contain rounded-lg"
              />
            )}

            <p className="text-white/50 text-xs text-center mt-3">
              Uploaded by {lightbox.uploadedBy ?? 'unknown'} · {format(new Date(lightbox.uploadedAt), 'PPP')}
              {lightbox.fileSizeBytes ? ` · ${fmtBytes(lightbox.fileSizeBytes)}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
