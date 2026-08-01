'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTeamMember, updateMemberRole, removeMember } from '@/app/(dashboard)/settings/team/actions';

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer (ดูอย่างเดียว)' },
  { value: 'creator', label: 'Creator (คิด Content)' },
  { value: 'editor', label: 'Editor (ตัดต่อ/อัปโหลดคลิป)' },
  { value: 'content_lead', label: 'Content Lead' },
  { value: 'media_buyer', label: 'Media Buyer' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' }
];

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

export default function TeamManagementClient({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('creator');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  async function handleCreate() {
    setError('');
    setCreated(null);
    setCreating(true);
    const formData = new FormData();
    formData.set('email', email);
    formData.set('full_name', fullName);
    formData.set('role', role);
    try {
      const result = await createTeamMember(formData);
      setCreated(result);
      setEmail('');
      setFullName('');
      setRole('creator');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'สร้าง account ไม่สำเร็จ');
    } finally {
      setCreating(false);
    }
  }

  function handleRoleChange(userId: string, newRole: string) {
    setError('');
    startTransition(async () => {
      try {
        await updateMemberRole(userId, newRole);
        router.refresh();
      } catch (err: any) {
        setError(err.message || 'เปลี่ยน role ไม่สำเร็จ');
      }
    });
  }

  function handleRemove(userId: string) {
    if (!confirm('ลบผู้ใช้นี้ออกจากระบบ? การกระทำนี้ย้อนกลับไม่ได้')) return;
    setError('');
    startTransition(async () => {
      try {
        await removeMember(userId);
        router.refresh();
      } catch (err: any) {
        setError(err.message || 'ลบผู้ใช้ไม่สำเร็จ');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">สร้าง Account พนักงานใหม่</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="field-label">อีเมล *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@email.com" />
          </div>
          <div>
            <label className="field-label">ชื่อ</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </div>
          <div>
            <label className="field-label">สิทธิ์ (Role)</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="btn-primary" disabled={!email || creating} onClick={handleCreate}>
          {creating ? 'กำลังสร้าง...' : 'สร้าง Account'}
        </button>

        {created && (
          <div className="card p-4 bg-surface text-sm space-y-1">
            <div className="font-semibold text-accentGreen">
              สร้างสำเร็จ — คัดลอกไปส่งให้พนักงานตอนนี้เลย (หน้านี้จะไม่แสดงรหัสผ่านนี้อีก)
            </div>
            <div>
              อีเมล: <span className="font-mono">{created.email}</span>
            </div>
            <div>
              รหัสผ่านชั่วคราว: <span className="font-mono font-semibold">{created.tempPassword}</span>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-gray-500">
            <tr>
              <th className="px-4 py-3">อีเมล</th>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">สิทธิ์</th>
              <th className="px-4 py-3">เข้าร่วมเมื่อ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-4 py-3">{m.email}</td>
                <td className="px-4 py-3">{m.full_name || '—'}</td>
                <td className="px-4 py-3">
                  <select value={m.role} disabled={isPending} onChange={(e) => handleRoleChange(m.id, e.target.value)}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(m.created_at).toLocaleDateString('th-TH')}</td>
                <td className="px-4 py-3 text-right">
                  {m.id !== currentUserId && (
                    <button className="text-red-600" disabled={isPending} onClick={() => handleRemove(m.id)}>
                      ลบ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
