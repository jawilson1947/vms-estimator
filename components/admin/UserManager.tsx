'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon, PencilIcon, TrashIcon, KeyIcon,
  EyeIcon, EyeSlashIcon, XMarkIcon, UserCircleIcon,
  CheckCircleIcon, ExclamationCircleIcon, BuildingOfficeIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'TECHNICIAN' | 'VIEWER' | 'PROJECT_VIEWER';

interface AdminUser {
  id: number;
  firstName: string | null;
  lastName:  string | null;
  username:  string;
  email:     string;
  phone:     string | null;
  role:      UserRole | null;
  isActive:  boolean;
  lastLogin: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:           'Administrator',
  PROJECT_MANAGER: 'Project Manager',
  TECHNICIAN:      'Technician',
  VIEWER:          'Viewer',
  PROJECT_VIEWER:  'Project Viewer',
};

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:           'bg-purple-100 text-purple-700',
  PROJECT_MANAGER: 'bg-blue-100 text-blue-700',
  TECHNICIAN:      'bg-amber-100 text-amber-700',
  VIEWER:          'bg-gray-100 text-gray-600',
  PROJECT_VIEWER:  'bg-teal-100 text-teal-700',
};

function roleChip(role: UserRole | null) {
  if (!role) return null;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function fullName(u: AdminUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Password field ─────────────────────────────────────────────────────────────

function PasswordField({
  label, value, onChange, error,
}: {
  label: string; value: string;
  onChange: (v: string) => void; error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full px-3 py-2 pr-10 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-400 ${
            error ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Text field ─────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', required, error,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  type?: string; required?: boolean; error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-400 ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium z-50 ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success'
        ? <CheckCircleIcon className="w-4 h-4" />
        : <ExclamationCircleIcon className="w-4 h-4" />}
      {message}
    </div>
  );
}

// ── Create / Edit Modal ────────────────────────────────────────────────────────

interface UserFormState {
  firstName: string; lastName: string; username: string;
  email: string; phone: string; role: UserRole; isActive: boolean;
  password: string; confirmPassword: string;
}

const EMPTY_FORM: UserFormState = {
  firstName: '', lastName: '', username: '', email: '',
  phone: '', role: 'VIEWER', isActive: true,
  password: '', confirmPassword: '',
};

function UserModal({
  user, onSave, onClose,
}: {
  user: AdminUser | null;
  onSave: (u: AdminUser) => void;
  onClose: () => void;
}) {
  const isNew = !user;
  const [form, setForm] = useState<UserFormState>(
    user
      ? {
          firstName: user.firstName ?? '', lastName: user.lastName ?? '',
          username: user.username, email: user.email, phone: user.phone ?? '',
          role: user.role ?? 'VIEWER', isActive: user.isActive,
          password: '', confirmPassword: '',
        }
      : { ...EMPTY_FORM }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Project-access selection (used only when role is PROJECT_VIEWER)
  const [allProjects, setAllProjects] = useState<AssignableProject[]>([]);
  const [projectIds,  setProjectIds]  = useState<Set<number>>(new Set());
  const [projSearch,  setProjSearch]  = useState('');

  useEffect(() => {
    (async () => {
      try {
        // userId 0 for a new user → returns the full project list with none assigned
        const res = await fetch(`/api/admin/users/${user?.id ?? 0}/projects`);
        const data = await res.json();
        if (res.ok) {
          setAllProjects(data.projects as AssignableProject[]);
          if (user) setProjectIds(new Set<number>(data.assigned as number[]));
        }
      } catch { /* non-fatal: picker just stays empty */ }
    })();
  }, [user]);

  function toggleProject(id: number) {
    setProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function set<K extends keyof UserFormState>(key: K, val: UserFormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.username.trim()) e.username = 'Required';
    if (!form.email.trim())    e.email    = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (isNew) {
      if (!form.password)          e.password        = 'Required';
      else if (form.password.length < 8) e.password  = 'Minimum 8 characters';
      if (form.password !== form.confirmPassword)    e.confirmPassword = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    try {
      const url  = isNew ? '/api/admin/users' : `/api/admin/users/${user!.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const body: Record<string, unknown> = {
        firstName: form.firstName || null,
        lastName:  form.lastName  || null,
        username:  form.username,
        email:     form.email,
        phone:     form.phone     || null,
        role:      form.role,
        isActive:  form.isActive,
      };
      if (isNew) body.password = form.password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      // Persist project access for restricted viewers (replaces their full set).
      const savedId = (data as AdminUser).id;
      if (form.role === 'PROJECT_VIEWER' && savedId) {
        await fetch(`/api/admin/users/${savedId}/projects`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectIds: Array.from(projectIds) }),
        });
      }

      onSave(data as AdminUser);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isNew ? 'New User' : `Edit — ${fullName(user!)}`}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" value={form.firstName} onChange={v => set('firstName', v)} />
            <Field label="Last name"  value={form.lastName}  onChange={v => set('lastName',  v)} />
          </div>
          <Field label="Username" value={form.username} onChange={v => set('username', v)} required error={errors.username} />
          <Field label="Email"    value={form.email}    onChange={v => set('email',    v)} type="email" required error={errors.email} />
          <Field label="Phone"    value={form.phone}    onChange={v => set('phone',    v)} type="tel" />

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
            >
              {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('isActive', !form.isActive)}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                form.isActive ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                form.isActive ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
            <span className="text-sm text-gray-700">{form.isActive ? 'Active' : 'Inactive'}</span>
          </div>

          {/* Project access — only for restricted Project Viewers */}
          {form.role === 'PROJECT_VIEWER' && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project access</p>
                <span className="text-xs text-gray-400">{projectIds.size} selected</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">This user will only be able to open the projects checked below.</p>
              <input
                value={projSearch}
                onChange={e => setProjSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 mb-2"
              />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                {allProjects.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No projects available.</p>
                ) : (
                  allProjects
                    .filter(p => {
                      const q = projSearch.trim().toLowerCase();
                      if (!q) return true;
                      return p.projectName.toLowerCase().includes(q)
                        || (p.projectNumber ?? '').toLowerCase().includes(q)
                        || p.customerName.toLowerCase().includes(q);
                    })
                    .map(p => (
                      <label key={p.id} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={projectIds.has(p.id)}
                          onChange={() => toggleProject(p.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-gray-800 truncate">{p.projectName}</span>
                          <span className="block text-xs text-gray-400 truncate">
                            {p.customerName}{p.projectNumber ? ` · ${p.projectNumber}` : ''}
                          </span>
                        </span>
                      </label>
                    ))
                )}
              </div>
            </div>
          )}

          {/* Password — only for new users */}
          {isNew && (
            <>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Password</p>
                <div className="space-y-3">
                  <PasswordField
                    label="Password"
                    value={form.password}
                    onChange={v => set('password', v)}
                    error={errors.password}
                  />
                  <PasswordField
                    label="Confirm password"
                    value={form.confirmPassword}
                    onChange={v => set('confirmPassword', v)}
                    error={errors.confirmPassword}
                  />
                </div>
              </div>
            </>
          )}

          {apiError && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{apiError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : isNew ? 'Create user' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change Password Modal ──────────────────────────────────────────────────────

function ChangePasswordModal({
  user, onClose, onSuccess,
}: {
  user: AdminUser; onClose: () => void; onSuccess: () => void;
}) {
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);

  async function handleSave() {
    const e: typeof errors = {};
    if (!password)              e.password = 'Required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    if (password !== confirmPassword) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update password');
      onSuccess();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500">Setting new password for <span className="font-medium text-gray-800">{fullName(user)}</span></p>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            error={errors.password}
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={errors.confirm}
          />
          {apiError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{apiError}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

function DeleteModal({
  user, onConfirm, onClose,
}: {
  user: AdminUser; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setApiError(null);
    try {
      await onConfirm();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        <div className="px-5 py-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <TrashIcon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Delete user?</h2>
              <p className="text-sm text-gray-500">This will permanently remove <span className="font-medium text-gray-800">{fullName(user)}</span>.</p>
            </div>
          </div>
          {apiError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{apiError}</p>}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Project Access Modal ─────────────────────────────────────────────────────

interface AssignableProject {
  id: number;
  projectName: string;
  projectNumber: string | null;
  customerName: string;
}

function ProjectAccessModal({
  user, onClose, onSaved,
}: {
  user: AdminUser; onClose: () => void; onSaved: () => void;
}) {
  const [projects, setProjects] = useState<AssignableProject[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${user.id}/projects`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load');
        setProjects(data.projects as AssignableProject[]);
        setSelected(new Set<number>(data.assigned as number[]));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/projects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? projects.filter(p =>
        p.projectName.toLowerCase().includes(q) ||
        (p.projectNumber ?? '').toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q))
    : projects;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5 text-teal-500" />
            <h2 className="text-base font-semibold text-gray-900">Project access — {fullName(user)}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-xs text-gray-400 mt-2">{selected.size} project{selected.size !== 1 ? 's' : ''} selected</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No projects found.</p>
          ) : filtered.map(p => (
            <label key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate">{p.projectName}</span>
                <span className="block text-xs text-gray-400 truncate">
                  {p.customerName}{p.projectNumber ? ` · ${p.projectNumber}` : ''}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error && <p className="mx-5 mb-2 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save access'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── UserManager ───────────────────────────────────────────────────────────────

export function UserManager({ currentUserId }: { currentUserId: number }) {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [editTarget,     setEditTarget]     = useState<AdminUser | null | 'new'>(null);
  const [pwTarget,       setPwTarget]       = useState<AdminUser | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<AdminUser | null>(null);
  const [projectsTarget, setProjectsTarget] = useState<AdminUser | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function handleSaved(saved: AdminUser) {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setEditTarget(null);
    showToast(saved.id ? 'User saved.' : 'User created.');
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Delete failed');
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
    setDeleteTarget(null);
    showToast('User deleted.');
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCircleIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">User Management</h2>
          {!loading && (
            <span className="text-xs text-gray-400">{users.length} user{users.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <button
          onClick={() => setEditTarget('new')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          New user
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Last login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{fullName(u)}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500">{u.phone || '—'}</td>
                    <td className="px-4 py-3">{roleChip(u.role)}</td>
                    <td className="px-4 py-3">
                      {u.isActive
                        ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircleSolid className="w-3.5 h-3.5" /> Active</span>
                        : <span className="text-xs text-gray-400">Inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(u.lastLogin)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.role === 'PROJECT_VIEWER' && (
                          <button
                            onClick={() => setProjectsTarget(u)}
                            title="Manage project access"
                            className="p-1.5 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
                          >
                            <BuildingOfficeIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditTarget(u)}
                          title="Edit"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPwTarget(u)}
                          title="Change password"
                          className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                        >
                          <KeyIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          disabled={u.id === currentUserId}
                          title={u.id === currentUserId ? 'Cannot delete yourself' : 'Delete'}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {editTarget !== null && (
        <UserModal
          user={editTarget === 'new' ? null : editTarget}
          onSave={handleSaved}
          onClose={() => setEditTarget(null)}
        />
      )}

      {pwTarget && (
        <ChangePasswordModal
          user={pwTarget}
          onClose={() => setPwTarget(null)}
          onSuccess={() => { setPwTarget(null); showToast('Password updated.'); }}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {projectsTarget && (
        <ProjectAccessModal
          user={projectsTarget}
          onClose={() => setProjectsTarget(null)}
          onSaved={() => { setProjectsTarget(null); showToast('Project access updated.'); }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
