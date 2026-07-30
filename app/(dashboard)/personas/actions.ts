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

function csvToArray(formData: FormData, key: string): string[] {
  const raw = str(formData, key);
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function personaPayload(formData: FormData) {
  return {
    name: str(formData, 'name') ?? '',
    age_range: str(formData, 'age_range'),
    life_stage: str(formData, 'life_stage'),
    pains: csvToArray(formData, 'pains'),
    desires: csvToArray(formData, 'desires'),
    objections: csvToArray(formData, 'objections'),
    triggers: csvToArray(formData, 'triggers'),
    preferred_language: str(formData, 'preferred_language'),
    content_formats: csvToArray(formData, 'content_formats'),
    funnel_notes: str(formData, 'funnel_notes')
  };
}

export async function createPersona(formData: FormData) {
  const supabase = createClient();
  const payload = personaPayload(formData);

  if (!payload.name) {
    redirect('/personas/new?error=' + encodeURIComponent('Name is required'));
  }

  const { error } = await supabase.from('personas').insert(payload);
  if (error) {
    redirect('/personas/new?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/personas');
  redirect('/personas');
}

export async function updatePersona(id: string, formData: FormData) {
  const supabase = createClient();
  const payload = personaPayload(formData);

  const { error } = await supabase.from('personas').update(payload).eq('id', id);
  if (error) {
    redirect(`/personas/${id}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath('/personas');
  redirect('/personas');
}

export async function deletePersona(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('personas').delete().eq('id', id);
  if (error) {
    redirect(`/personas/${id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath('/personas');
  redirect('/personas');
}
