import { createClient } from '@/lib/supabase/server';
import BannerGeneratorClient from '@/components/banner-generator-client';

export default async function BannerGeneratorPage() {
  const supabase = createClient();
  const [{ data: history }, { data: products }, { data: knowledgeItems }] = await Promise.all([
    supabase.from('banner_generator_jobs').select('id, product_name, template, image_count, created_at').order('created_at', { ascending: false }).limit(10),
    supabase
      .from('products')
      .select(
        'id, product_name, brand, category, usp, ingredients, benefits, usage, allowed_claims, banned_claims, compliance_notes, selling_price, promotion_price'
      )
      .order('created_at', { ascending: false }),
    supabase.from('knowledge_items').select('id, title, type, content, product_ids').in('type', ['PRODUCT', 'COMPLIANCE']).eq('status', 'active').limit(300)
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">สร้างภาพโฆษณา AI (Banner Generator)</h1>
        <p className="text-gray-500">วิเคราะห์สินค้าและเสนอ Concept ก่อน หรือสั่งสร้างภาพ Concept 1-9 ทันที — ใช้ระบบ Prompt เดียวกับที่ทีมครีเอทีฟใช้จริง</p>
      </div>
      <BannerGeneratorClient history={history ?? []} products={products ?? []} knowledgeItems={knowledgeItems ?? []} />
    </div>
  );
}
