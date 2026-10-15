'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeActId } from '@/lib/ads/status';

// Both actions run as the signed-in user, so Postgres RLS decides who may
// write (ad_accounts_write / ad_accounts_update: admin, owner, media_buyer).
// They only change which accounts ads-sync pulls — nothing here talks to Meta
// and nothing can pause, scale or edit an ad.

export async function setAccountSync(id: string, enable: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('ad_accounts')
    .update({ status: enable ? 'active' : 'paused', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) redirect('/ads?error=' + encodeURIComponent(error.message));
  revalidatePath('/ads');
}

export async function addAccount(formData: FormData) {
  const supabase = createClient();
  const actId = normalizeActId(String(formData.get('act_id') ?? ''));
  const label = String(formData.get('label') ?? '').trim().slice(0, 120);

  if (!actId) {
    redirect('/ads?error=' + encodeURIComponent('เลขบัญชีโฆษณาไม่ถูกต้อง — ใส่ตัวเลข 5–20 หลัก (มี act_ นำหน้าหรือไม่ก็ได้)'));
  }

  const { data: existing } = await supabase.from('ad_accounts').select('id').eq('meta_account_id', actId).maybeSingle();
  if (existing) redirect('/ads?error=' + encodeURIComponent(`บัญชี ${actId} มีอยู่ในระบบแล้ว`));

  const { error } = await supabase.from('ad_accounts').insert({
    meta_account_id: actId,
    name: label || actId,
    status: 'active',
    source: 'manual'
  });
  if (error) redirect('/ads?error=' + encodeURIComponent(error.message));

  revalidatePath('/ads');
  redirect('/ads');
}
