import { createClient } from '@/lib/supabase/server';
import CreativeGeneratorPageClient from '@/components/creative-generator-page-client';

export default async function CreativeGeneratorPage() {
  const supabase = createClient();
  const [{ data: products }, { data: personas }, { data: bannerHistory }, { data: knowledgeItems }] = await Promise.all([
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
      .limit(300)
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Creative Generator</h1>
        <p className="text-gray-500">Idea → Script → Storyboard ต่อเนื่องเป็นขั้นตอน หรือสร้างภาพโฆษณา AI แยกเดี่ยว</p>
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
        />
      )}
    </div>
  );
}
