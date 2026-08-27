'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export async function createRule(formData: FormData) {
  const supabase = createClient();

  const name = str(formData, 'name');
  const metric = str(formData, 'metric');
  const operator = str(formData, 'operator');
  const threshold = num(formData, 'threshold');
  const time_window_minutes = num(formData, 'time_window_minutes') ?? 60;
  const action = str(formData, 'action');
  const budget_change_percent = num(formData, 'budget_change_percent');
  const cooldown_hours = num(formData, 'cooldown_hours') ?? 6;
  const ad_account_id = str(formData, 'ad_account_id');

  if (!name || !metric || !operator || threshold === null || !action) {
    redirect('/ads/rules/new?error=' + encodeURIComponent('กรอกข้อมูลให้ครบ: ชื่อ, metric, operator, threshold, action'));
  }

  if (action === 'scale_budget') {
    if (budget_change_percent === null) {
      redirect('/ads/rules/new?error=' + encodeURIComponent('action = scale_budget ต้องระบุ % เพิ่ม/ลด budget'));
    }
    if (Math.abs(budget_change_percent) > 20) {
      redirect('/ads/rules/new?error=' + encodeURIComponent('% เพิ่ม/ลด budget ต้องไม่เกิน ±20% ต่อรอบ'));
    }
  }

  const { error } = await supabase.from('ad_automation_rules').insert({
    name,
    metric,
    operator,
    threshold,
    time_window_minutes,
    action,
    budget_change_percent: action === 'scale_budget' ? budget_change_percent : null,
    cooldown_hours,
    ad_account_id: ad_account_id || null
  });

  if (error) redirect('/ads/rules/new?error=' + encodeURIComponent(error.message));

  revalidatePath('/ads/rules');
  redirect('/ads/rules');
}

export async function toggleRuleEnabled(id: string, enabled: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('ad_automation_rules')
    .update({ enabled: !enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) redirect('/ads/rules?error=' + encodeURIComponent(error.message));
  revalidatePath('/ads/rules');
}

export async function deleteRule(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('ad_automation_rules').delete().eq('id', id);
  if (error) redirect('/ads/rules?error=' + encodeURIComponent(error.message));
  revalidatePath('/ads/rules');
  redirect('/ads/rules');
}
