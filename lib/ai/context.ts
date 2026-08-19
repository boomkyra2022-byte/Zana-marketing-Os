import type { SupabaseClient } from '@supabase/supabase-js';

// MASTER_PROMPT_V2 "Context Retrieval": before every generate call —
// 1 fetch Product, 2 fetch Persona, 3 fetch relevant Knowledge,
// 4 fetch Winners/Learnings, 5 compile compact context, 6 call AI.
// "ห้ามส่ง Knowledge ทั้งฐานแบบไม่กรอง" — never dump the whole KB, filter first.

export interface CreativeContext {
  product: any;
  persona: any | null;
  knowledgeText: string;
  winnersText: string;
}

export async function getRelevantCreativeContext(
  supabase: SupabaseClient,
  opts: { productId: string; personaId?: string | null }
): Promise<CreativeContext> {
  const [{ data: product }, personaResult, knowledgeResult, winnersResult] = await Promise.all([
    supabase.from('products').select('*').eq('id', opts.productId).single(),
    opts.personaId
      ? supabase.from('personas').select('*').eq('id', opts.personaId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('knowledge_items')
      .select('title, type, content, product_ids, persona_ids, confidence, effective_to')
      .eq('status', 'active')
      .order('confidence', { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from('winners')
      .select('hook, creative_format, funnel_stage, why_it_won, replicable_pattern, product_id, persona_id')
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  const persona = personaResult.data;
  const now = new Date();

  const knowledgeItems = (knowledgeResult.data ?? []).filter((item: any) => {
    if (item.effective_to && new Date(item.effective_to) < now) return false;
    const productIds: string[] = Array.isArray(item.product_ids) ? item.product_ids : [];
    const personaIds: string[] = Array.isArray(item.persona_ids) ? item.persona_ids : [];
    const matchesProduct = productIds.length === 0 || productIds.includes(opts.productId);
    const matchesPersona = !opts.personaId || personaIds.length === 0 || personaIds.includes(opts.personaId);
    const isGlobalType = ['BRAND', 'CONTENT_RULES'].includes(item.type);
    return isGlobalType || (matchesProduct && matchesPersona);
  });

  const knowledgeText =
    knowledgeItems.length > 0
      ? knowledgeItems.slice(0, 15).map((k: any) => `[${k.type}] ${k.title}: ${k.content}`).join('\n')
      : '(no relevant knowledge base items found — proceed generically but flag this in risks)';

  const relevantWinners = (winnersResult.data ?? []).filter(
    (w: any) => !w.product_id || w.product_id === opts.productId
  );

  const winnersText =
    relevantWinners.length > 0
      ? relevantWinners
          .map((w: any) => `Winner hook: "${w.hook}" (${w.creative_format}, ${w.funnel_stage}) — why it won: ${w.why_it_won}. Replicable: ${w.replicable_pattern}`)
          .join('\n')
      : '(no marked winners yet for this product)';

  return { product, persona, knowledgeText, winnersText };
}

// Added for Flow Prompt Director: same context-retrieval logic as
// getRelevantCreativeContext, but productId is optional — the Director can
// be used standalone with no product linked (e.g. pure brand content),
// which the original function above doesn't support (it does a hard
// `.eq('id', productId).single()` that throws when productId is missing).
// Left the original function untouched to avoid any risk to existing
// callers (idea/script/storyboard generators).
export async function getOptionalCreativeContext(
  supabase: SupabaseClient,
  opts: { productId?: string | null; personaId?: string | null }
): Promise<CreativeContext> {
  if (opts.productId) {
    return getRelevantCreativeContext(supabase, { productId: opts.productId, personaId: opts.personaId });
  }

  const [personaResult, knowledgeResult, winnersResult] = await Promise.all([
    opts.personaId
      ? supabase.from('personas').select('*').eq('id', opts.personaId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('knowledge_items')
      .select('title, type, content, product_ids, persona_ids, confidence, effective_to')
      .eq('status', 'active')
      .in('type', ['BRAND', 'CONTENT_RULES'])
      .order('confidence', { ascending: false, nullsFirst: false })
      .limit(15),
    Promise.resolve({ data: [] as any[] })
  ]);

  const persona = personaResult.data;
  const now = new Date();
  const knowledgeItems = (knowledgeResult.data ?? []).filter((item: any) => !item.effective_to || new Date(item.effective_to) >= now);
  const knowledgeText =
    knowledgeItems.length > 0
      ? knowledgeItems.map((k: any) => `[${k.type}] ${k.title}: ${k.content}`).join('\n')
      : '(no product linked — no relevant knowledge base items found)';

  return { product: null, persona, knowledgeText, winnersText: '(no product linked — winners not applicable)' };
}
