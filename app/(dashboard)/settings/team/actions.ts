'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

const VALID_ROLES = ['admin', 'owner', 'content_lead', 'creator', 'editor', 'media_buyer', 'viewer'];

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('กรุณาล็อกอินก่อน');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    throw new Error('หน้านี้สำหรับแอดมินเท่านั้น');
  }
  return { supabase, user };
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(16);
  let pw = '';
  for (let i = 0; i < 14; i++) pw += chars[bytes[i] % chars.length];
  return pw;
}

export async function createTeamMember(formData: FormData): Promise<{ email: string; tempPassword: string }> {
  await requireAdmin();

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') || '').trim();
  const role = String(formData.get('role') || 'viewer');

  if (!email || !email.includes('@')) throw new Error('กรุณากรอกอีเมลให้ถูกต้อง');
  if (!VALID_ROLES.includes(role)) throw new Error('Role ไม่ถูกต้อง');

  let serviceClient;
  try {
    serviceClient = createServiceRoleClient();
  } catch {
    throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ใน .env.local — ต้องใส่ก่อนถึงจะสร้าง account พนักงานจากหน้านี้ได้');
  }

  const tempPassword = generateTempPassword();

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName || null }
  });

  if (error) throw new Error(error.message || 'สร้าง account ไม่สำเร็จ');
  if (!data?.user) throw new Error('สร้าง account ไม่สำเร็จ (ไม่ได้รับข้อมูลผู้ใช้กลับมา)');

  // The on_auth_user_created trigger always creates the profiles row with
  // role='viewer' and status='pending' (see migration 0022 — that's the
  // default for the public self-signup path). An account created HERE was
  // already vetted by an admin (this whole function requires requireAdmin()
  // above), so it should be usable immediately — bump role (if not the
  // 'viewer' default) and always flip status to 'approved' in one update.
  // service-role client, not `supabase` — bypasses the anti-privilege-
  // escalation trigger's admin/owner check cleanly since it runs with no
  // RLS/auth.uid() context at all (same trust model as createUser() above).
  await serviceClient.from('profiles').update({ role, status: 'approved' }).eq('id', data.user.id);

  revalidatePath('/settings/team');
  return { email, tempPassword };
}

export async function updateMemberRole(userId: string, role: string): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!VALID_ROLES.includes(role)) throw new Error('Role ไม่ถูกต้อง');

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw new Error(error.message);

  revalidatePath('/settings/team');
}

// Approval queue — explicit user request: "ตั้งรหัสเจ้าของสำหรับปลดล็อคการ
// สมัครสมาชิก หรืออนุมัติให้เข้าใช้งานได้" (chose "ทั้งสองอย่าง"). A public
// self-signup (even with the correct access code) lands here as
// status='pending' and is blocked from the whole dashboard by middleware.ts
// until an admin/owner approves them from this page.
const VALID_STATUSES = ['pending', 'approved', 'rejected'];

export async function updateMemberStatus(userId: string, status: string): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!VALID_STATUSES.includes(status)) throw new Error('สถานะไม่ถูกต้อง');

  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
  if (error) throw new Error(error.message);

  revalidatePath('/settings/team');
}

export async function removeMember(userId: string): Promise<void> {
  const { user } = await requireAdmin();
  if (userId === user.id) throw new Error('ลบ account ของตัวเองไม่ได้');

  let serviceClient;
  try {
    serviceClient = createServiceRoleClient();
  } catch {
    throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ใน .env.local');
  }

  const { error } = await serviceClient.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath('/settings/team');
}
