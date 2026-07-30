'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const KNOWLEDGE_TYPES = [
  'PRODUCT','PERSONA','BRAND','OFFER','CREATIVE_PATTERN','WINNER_LEARNING',
  'LOSER_LEARNING','COMPLIANCE','FAQ','CAMPAIGN','MARKET_INSIGHT'
] as const;

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

function csvToArray(formData: FormData, key: string): string[] {
  const raw = str(formData, key);
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function knowledgePayload(formData: FormData) {
  const type = str(formData, 'type') ?? 'FAQ';
  return {
    title: str(formData, 'title') ?? '',
    type: (KNOWLEDGE_TYPES as readonly string[]).includes(type) ? type : 'FAQ',
    content: str(formData, 'content') ?? '',
    tags: csvToArray(formData, 'tags'),
    source: str(formData, 'source'),
    confidence: str(formData, 'confidence') ? Number(str(formData, 'confidence')) : null,
    status: str(formData, 'status') ?? 'active'
  };
}

export async function createKnowledgeItem(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const payload = knowledgePayload(formData);

  if (!payload.title || !payload.content) {
    redirect('/knowledge/new?error=' + encodeURIComponent('Title and Content are required'));
  }

  const { error } = await supabase.from('knowledge_items').insert({ ...payload, created_by: user?.id ?? null });
  if (error) {
    redirect('/knowledge/new?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/knowledge');
  redirect('/knowledge');
}

export async function updateKnowledgeItem(id: string, formData: FormData) {
  const supabase = createClient();
  const payload = knowledgePayload(formData);

  const { error } = await supabase
    .from('knowledge_items')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    redirect(`/knowledge/${id}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath('/knowledge');
  redirect('/knowledge');
}

export async function deleteKnowledgeItem(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('knowledge_items').delete().eq('id', id);
  if (error) {
    redirect(`/knowledge/${id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath('/knowledge');
  redirect('/knowledge');
}
