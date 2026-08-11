import { createClient } from '@/lib/supabase/server';
import FlowPromptClient from '@/components/flow-prompt-client';

export default async function FlowPromptPage() {
  const supabase = createClient();
  const [{ data: products }, { data: recentSets }] = await Promise.all([
    supabase.from('products').select('id, product_name, brand, usp').order('created_at', { ascending: false }),
    supabase
      .from('flow_prompts')
      .select('id, video_concept, inputs, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gen Prompt (Google Flow)</h1>
        <p className="text-gray-500">
          กรอกสินค้า เป้าหมาย และเนื้อหาคร่าวๆ AI จะคิด Video Flow + เขียน Production Prompt ระดับมืออาชีพให้ครบทุก Scene พร้อม Copy ไปวางใน
          Google Flow ได้ทันที
        </p>
      </div>
      <FlowPromptClient products={products ?? []} recentSets={recentSets ?? []} />
    </div>
  );
}
