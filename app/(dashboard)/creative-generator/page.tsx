import { createClient } from '@/lib/supabase/server';
import CreativeGeneratorPageClient from '@/components/creative-generator-page-client';

// searchParams `load_idea` / `load_script` — explicit user request for
// history/reuse ("ที่ Gen ไปแล้วยังขาด History ... หรือเลือกนำกลับมาใช้อีกครั้ง").
// The standalone Content Library page (/content-library) links back here as
// `/creative-generator?load_idea=<id>` or `?load_script=<id>` so a past
// record can be re-opened straight into the pipeline; fetched server-side
// (same pattern as everything else on this page) rather than adding a new
// client-side fetch/API route just for this.
export default async function CreativeGeneratorPage({
  searchParams
}: {
  searchParams?: { load_idea?: string; load_script?: string };
}) {
  const supabase = createClient();
  const [
    { data: products },
    { data: personas },
    { data: bannerHistory },
    { data: knowledgeItems },
    { data: recentIdeas },
    { data: recentScripts },
    { data: recentStoryboards }
  ] = await Promise.all([
    // Extra columns beyond id/product_name/brand are for the Banner
    // Generator's "เลือกสินค้าจากคลัง" autofill (explicit user request) —
    // CreativeGeneratorClient only reads id/product_name/brand and ignores
    // the rest, so this is safe to widen without touching that component.
    supabase
      .from('products')
      .select(
        'id, product_name, brand, category, usp, ingredients, benefits, usage, allowed_claims, banned_claims, compliance_notes, selling_price, promotion_price'
      )
      .order('created_at', { ascending: false }),
    supabase.from('personas').select('id, name').order('created_at', { ascending: false }),
    supabase.from('banner_generator_jobs').select('id, product_name, template, image_count, created_at').order('created_at', { ascending: false }).limit(10),
    // Same request: pull Knowledge Base facts linked to a product (verified
    // selling points / compliance notes) so picking a product also surfaces
    // anything the team has logged there, not just the Products table.
    supabase
      .from('knowledge_items')
      .select('id, title, type, content, product_ids')
      .in('type', ['PRODUCT', 'COMPLIANCE'])
      .eq('status', 'active')
      .limit(300),
    // Recent history for the "ประวัติ" panels in each step — capped at 20 so
    // this stays a quick glance, not a full archive (that's what
    // /content-library is for). select('*') so every field the pipeline's
    // own state shape needs (Idea/Script/Storyboard types) is present when a
    // "ใช้ต่อ" click merges one of these straight into React state.
    supabase.from('ideas').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('scripts').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('storyboards').select('*').order('created_at', { ascending: false }).limit(20)
  ]);

  // Deep-link reuse from /content-library ("ใช้ต่อ" there navigates here with
  // ?load_idea=<id> or ?load_script=<id>). Look in the recent-20 lists first
  // (covers the common case with zero extra queries); only fetch
  // individually if the requested record is older than that.
  let initialIdea = searchParams?.load_idea ? recentIdeas?.find((i: any) => i.id === searchParams.load_idea) ?? null : null;
  if (searchParams?.load_idea && !initialIdea) {
    const { data } = await supabase.from('ideas').select('*').eq('id', searchParams.load_idea).single();
    initialIdea = data ?? null;
  }
  let initialScript = searchParams?.load_script ? recentScripts?.find((s: any) => s.id === searchParams.load_script) ?? null : null;
  if (searchParams?.load_script && !initialScript) {
    const { data } = await supabase.from('scripts').select('*').eq('id', searchParams.load_script).single();
    initialScript = data ?? null;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Creative Generator</h1>
        <p className="text-gray-500">Idea → Script → Storyboard ต่อเนื่องเป็นขั้นตอน, สร้างภาพโฆษณา AI แยกเดี่ยว, หรือคิดแคปชั่นแยกเดี่ยว</p>
      </div>

      {(products?.length ?? 0) === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          ต้องมีสินค้าอย่างน้อย 1 รายการก่อน — ไปที่หน้า <a href="/products/new" className="text-accentBlue">Products</a> เพื่อเพิ่มสินค้า
        </div>
      ) : (
        <CreativeGeneratorPageClient
          products={products ?? []}
          personas={personas ?? []}
          bannerHistory={bannerHistory ?? []}
          knowledgeItems={knowledgeItems ?? []}
          recentIdeas={recentIdeas ?? []}
          recentScripts={recentScripts ?? []}
          recentStoryboards={recentStoryboards ?? []}
          initialIdea={initialIdea}
          initialScript={initialScript}
        />
      )}
    </div>
  );
}
