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

  // The on_auth_user_created trigger always creates the profiles row with role='viewer'.
  // Bump it to the chosen role right away (skip the call entirely if 'viewer' was chosen).
  if (role !== 'viewer') {
    await serviceClient.from('profiles').update({ role }).eq('id', data.user.id);
  }

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
