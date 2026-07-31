import { createClient } from '@/lib/supabase/server';
import CreativeGeneratorClient from '@/components/creative-generator-client';

export default async function CreativeGeneratorPage() {
  const supabase = createClient();
  const [{ data: products }, { data: personas }] = await Promise.all([
    supabase.from('products').select('id, product_name, brand').order('created_at', { ascending: false }),
    supabase.from('personas').select('id, name').order('created_at', { ascending: false })
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Creative Generator</h1>
        <p className="text-gray-500">Idea → Script → Storyboard ในหน้าเดียว ต่อเนื่องเป็นขั้นตอน</p>
      </div>

      {(products?.length ?? 0) === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          ต้องมีสินค้าอย่างน้อย 1 รายการก่อน — ไปที่หน้า <a href="/products/new" className="text-accentBlue">Products</a> เพื่อเพิ่มสินค้า
        </div>
      ) : (
        <CreativeGeneratorClient products={products ?? []} personas={personas ?? []} />
      )}
    </div>
  );
}
