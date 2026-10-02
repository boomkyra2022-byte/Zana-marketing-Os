import { createClient } from '@/lib/supabase/server';
import HookGeneratorClient from '@/components/hook-generator-client';

export default async function HookGeneratorPage() {
  const supabase = createClient();
  const { data: products } = await supabase.from('products').select('id, product_name, brand').order('created_at', { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hook Generator</h1>
        <p className="text-gray-500">
          คลัง 300 Hook ปิดการขาย 15 สาย — เลือกแล้ว copy ไปใช้ได้ทันที หรือให้ AI เขียนใหม่ตามข้อมูลสินค้าจริง ใช้ได้ทั้งเปิดคลิป แคปชัน และปิดการขายท้ายคลิป
        </p>
      </div>
      <HookGeneratorClient products={products ?? []} />
    </div>
  );
}
