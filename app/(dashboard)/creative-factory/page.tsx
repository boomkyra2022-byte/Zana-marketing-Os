import { createClient } from '@/lib/supabase/server';
import { CreativeGenerator } from '@/components/creative-generator';

export default async function Page() {
  const supabase = createClient();
  const [{ data: products }, { data: personas }] = await Promise.all([
    supabase.from('products').select('id, product_name, brand').eq('status', 'active').order('product_name'),
    supabase.from('personas').select('id, name').order('name')
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">โรงงานครีเอทีฟ</h1>
        <p className="text-gray-400 text-sm">
          Knowledge Base → Idea → Script → Video Storyboard — ทุกขั้นตอนดึงข้อมูลจริงจาก Database และ AI จริง ไม่มี mock
        </p>
      </div>

      {(!products || products.length === 0) ? (
        <div className="card p-8 text-center text-gray-400">
          ยังไม่มีสินค้าในระบบ — ไปที่เมนู &quot;สินค้า&quot; เพื่อเพิ่มสินค้าก่อน แล้วค่อยกลับมาสร้าง Creative
        </div>
      ) : (
        <CreativeGenerator products={products} personas={personas ?? []} />
      )}
    </div>
  );
}
