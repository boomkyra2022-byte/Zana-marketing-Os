import { createClient } from '@/lib/supabase/server';
import VideoAnalyzerClient from '@/components/video-analyzer-client';

export default async function VideoAnalyzerPage() {
  const supabase = createClient();
  const [{ data: products }, { data: personas }, { data: ideas }, { data: scripts }, { data: storyboards }] = await Promise.all([
    supabase.from('products').select('id, product_name, brand').order('created_at', { ascending: false }),
    supabase.from('personas').select('id, name').order('created_at', { ascending: false }),
    supabase.from('ideas').select('id, title').order('created_at', { ascending: false }).limit(30),
    supabase.from('scripts').select('id, title').order('created_at', { ascending: false }).limit(30),
    supabase.from('storyboards').select('id, title').order('created_at', { ascending: false }).limit(30)
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Video Analyzer</h1>
        <p className="text-gray-500">วางลิงก์ Google Drive (Anyone with the link) แล้วให้ AI เปิดดูคลิปจริง ให้ Creative Score + จุดแก้ไข</p>
      </div>

      {(products?.length ?? 0) === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          ต้องมีสินค้าอย่างน้อย 1 รายการก่อน — ไปที่หน้า <a href="/products/new" className="text-accentBlue">Products</a> เพื่อเพิ่มสินค้า
        </div>
      ) : (
        <VideoAnalyzerClient
          products={products ?? []}
          personas={personas ?? []}
          ideas={ideas ?? []}
          scripts={scripts ?? []}
          storyboards={storyboards ?? []}
        />
      )}
    </div>
  );
}
