'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

// Signup gate — explicit user request, real risk confirmed: this form used
// to let anyone who found the /login URL create their own account with
// nothing but an email+password, and the DB's own handle_new_user() trigger
// would immediately give them a `profiles` row readable by every table
// gated on `auth.role() = 'authenticated'`. User chose "ทั้งสองอย่าง" (both
// layers): (1) this access-code check, so account creation itself requires
// a secret only the owner hands out, AND (2) an owner-approval queue
// (migration 0022_signup_approval_gate.sql — new accounts start
// `status='pending'` and can't reach the dashboard, see middleware.ts, until
// approved from /settings/team). Fails CLOSED: if the owner hasn't set
// SIGNUP_ACCESS_CODE yet, signup is entirely blocked rather than silently
// left open by a missing env var.
export async function signUp(formData: FormData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const fullName = String(formData.get('full_name') || '');
  const accessCode = String(formData.get('access_code') || '');

  const requiredCode = process.env.SIGNUP_ACCESS_CODE;
  if (!requiredCode) {
    redirect(`/login?error=${encodeURIComponent('ระบบสมัครสมาชิกยังไม่เปิดใช้งาน — ติดต่อเจ้าของระบบ')}`);
  }
  if (accessCode !== requiredCode) {
    redirect(`/login?error=${encodeURIComponent('รหัสเจ้าของไม่ถูกต้อง')}`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    '/login?message=' +
      encodeURIComponent('ตรวจสอบอีเมลเพื่อยืนยันบัญชี จากนั้นรอเจ้าของระบบอนุมัติสิทธิ์เข้าใช้งานก่อนถึงจะ login เข้า Dashboard ได้')
  );
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
