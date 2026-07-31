'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function saveSetting(key: string, value: unknown) {
  const supabase = createClient();
  const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}

export async function saveAiSettings(formData: FormData) {
  const value = {
    provider: String(formData.get('provider') || 'openai'),
    model: String(formData.get('model') || ''),
    temperature: Number(formData.get('temperature') || 0.7),
    max_ideas: Number(formData.get('max_ideas') || 20),
    max_scripts: Number(formData.get('max_scripts') || 5),
    max_storyboards: Number(formData.get('max_storyboards') || 3),
    max_scenes: Number(formData.get('max_scenes') || 8),
    max_frames: Number(formData.get('max_frames') || 40),
    max_duration_sec: Number(formData.get('max_duration_sec') || 60),
    transcription_model: String(formData.get('transcription_model') || ''),
    prompt_version: String(formData.get('prompt_version') || 'v1')
  };
  await saveSetting('ai', value);
}

export async function saveScoringSettings(formData: FormData) {
  const value = {
    reject_below: Number(formData.get('reject_below') || 60),
    revise_below: Number(formData.get('revise_below') || 75),
    priority_test_above: Number(formData.get('priority_test_above') || 85)
  };
  await saveSetting('scoring', value);
}
