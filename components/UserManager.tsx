'use client';

import { useState } from 'react';
import {
  PlusIcon, PencilIcon, TrashIcon, CheckIcon,
  ShieldCheckIcon, UserIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'TECHNICIAN' | 'VIEWER';

interface UserRow {
  id: number;
  firstName: string | null;
  lastName:  string | null;
  username:  string;
  email:     string;
  role:      UserRole | null;
  isActive:  boolean;
  lastLogin: string | null;
  createdAt: string;
}

interface Props { initialUsers: UserRow[]; currentUserId: number }

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN',           label: 'Administrator'   },
  { value: 'PROJECT_MANAGER', label: 'Project Manager' },
  { value: 'TECHNICIAN',      label: 'Technician'      },
  { value: 'VIEWER',          label: 'Viewer'          },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:           'bg-red-50 text-red-700',
  PROJECT_MANAGER: 'bg-blue-50 text-blue-700',
  TECHNICIAN:      'bg-amber-50 text-amber-700',
  VIEWER:          'bg-gray-100 text-gray-600',
};

const EMPTY_FORM = {
  firstName: '', lastName: '', username: '', email: '',
  role: 'VIEWER' as UserRole, isActive: true, password: '',
};

export function UserManager({ initialUsers, currentUserId }: Props) {
  const [users, setUsers]             = useState<UserRow[]>(initialUsers);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<number | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u.id);
    setForm({
      firstName: u.firstName ?? '',
      lastName:  u.lastName  ?? '',
      username:  u.username,
      email:     u.email,
      role:      u.role ?? 'VIEWER',
      isActive:  u.isActive,
      password:  '',
    });
    setError('');
    setShowForm(true);
  };

  const set = (k: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
      setForm(f => ({ ...f, [k]: val }));
    };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let res: Response;
      if (editing !== null) {
        res = await fetch(`/api/admin/users/${editing}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, password: form.password || undefined }),
        });
      } else {
        if (!form.password) { setError('Password is required for new users.'); setSaving(false); return; }
        res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }

      if (!res.ok) {
        const j = await res.json();
        setError(j.error || 'Save failed.');
        return;
      }

      const user: UserRow = await res.json();
      if (editing !== null) {
        setUsers(prev => prev.map(u => u.id === editing ? user : u));
      } else {
        setUsers(prev => [...prev, user]);
      }
      setShowForm(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id));
      setDeleteConfirm(null);
    }
  };

  const toggleActive = async (u: UserRow) => {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      const updated: UserRow = await res.json();
      setUsers(prev => prev.map(x => x.id === updated.id ? updated : x));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <UserIcon className="w-4 h-4" />
          Users
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {users.length}
          </span>
        </h2>
        <button onClick={openAdd} className="btn-primary text-xs flex items-center gap-1.5">
          <PlusIcon className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-5 mb-5 border-blue-200 bg-blue-50/30">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            {editing !== null ? 'Edit User' : 'New User'}
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input type="text" value={form.firstName} onChange={set('firstName')}
                className="input-field text-sm" placeholder="First name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input type="text" value={form.lastName} onChange={set('lastName')}
                className="input-field text-sm" placeholder="Last name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
              <input type="text" value={form.username} onChange={set('username')}
                className="input-field text-sm" placeholder="login username"
                disabled={editing !== null} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={set('email')}
                className="input-field text-sm" placeholder="email@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select value={form.role} onChange={set('role')} className="input-field text-sm">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {editing !== null ? 'New Password (leave blank to keep)' : 'Password *'}
              </label>
              <input type="password" value={form.password} onChange={set('password')}
                className="input-field text-sm" placeholder={editing !== null ? 'Leave blank to keep current' : 'Min 8 characters'} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.username || !form.email || saving}
              className="btn-primary text-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save User'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Username</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Last Login</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Created</th>
              <th className="py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 group">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                      {(u.firstName?.[0] ?? u.username[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.username}
                      </p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${ROLE_COLORS[u.role ?? 'VIEWER']}`}>
                    {ROLES.find(r => r.value === u.role)?.label ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => u.id !== currentUserId && toggleActive(u)}
                    className={`badge ${u.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'} ${u.id !== currentUserId ? 'cursor-pointer hover:opacity-75' : ''}`}
                    title={u.id !== currentUserId ? 'Click to toggle' : 'Cannot deactivate your own account'}
                  >
                    {u.isActive ? '● Active' : '○ Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.lastLogin ? format(new Date(u.lastLogin), 'MMM d, yyyy') : 'Never'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {format(new Date(u.createdAt), 'MMM d, yyyy')}
                </td>
                <td className="py-3 pr-4 text-right">
                  <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(u)}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => setDeleteConfirm(u.id)}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 mb-2">Delete user?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This permanently removes the user account. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
