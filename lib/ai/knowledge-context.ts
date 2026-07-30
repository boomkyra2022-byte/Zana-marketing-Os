import type { SupabaseClient } from '@supabase/supabase-js';

// MASTER_PROMPT §14: every AI generation must query relevant Knowledge Base
// first, priority order: active business truth > latest approved facts >
// product-specific rules > historical learnings. Deprecated items excluded.
export async function getKnowledgeContext(
  supabase: SupabaseClient,
  opts: { productId?: string | null; personaId?: string | null }
): Promise<string> {
  const { data, error } = await supabase
    .from('knowledge_items')
    .select('title, type, content, product_ids, persona_ids, confidence, effective_from, effective_to')
    .eq('status', 'active')
    .order('confidence', { ascending: false, nullsFirst: false })
    .limit(30);

  if (error || !data) return '(no knowledge base data available)';

  const now = new Date();
  const relevant = data.filter((item) => {
    if (item.effective_to && new Date(item.effective_to) < now) return false;
    const productIds: string[] = Array.isArray(item.product_ids) ? item.product_ids : [];
    const personaIds: string[] = Array.isArray(item.persona_ids) ? item.persona_ids : [];
    const matchesProduct = !opts.productId || productIds.length === 0 || productIds.includes(opts.productId);
    const matchesPersona = !opts.personaId || personaIds.length === 0 || personaIds.includes(opts.personaId);
    // Keep brand/compliance/global items regardless of product/persona scoping.
    const isGlobalType = ['BRAND', 'COMPLIANCE', 'MARKET_INSIGHT'].includes(item.type);
    return isGlobalType || (matchesProduct && matchesPersona);
  });

  if (relevant.length === 0) return '(no relevant knowledge base items found — proceed generically but flag this in risks)';

  return relevant
    .slice(0, 15)
    .map((item) => `[${item.type}] ${item.title}: ${item.content}`)
    .join('\n');
}
