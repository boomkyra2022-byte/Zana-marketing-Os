import { createClient } from '@/lib/supabase/server';
import ContentLibraryClient from '@/components/content-library-client';

// Standalone archive/browse page — explicit user request: "ที่ Gen ไปแล้วยังขาด
// History หรือเปล่า สำหรับย้อนดูงานได้ หรือเลือกนำกลับมาใช้อีกครั้ง", scope
// chosen as "ทั้งสองอย่าง" (both the quick in-page history panels on
// /creative-generator AND this dedicated searchable library). This is the
// "search/filter across everything, no matter how long ago" half — the
// in-page panels only show the most recent 20 of each.
export default async function ContentLibraryPage() {
  const supabase = createClient();
  const [{ data: products }, { data: ideas }, { data: scripts }, { data: storyboards }] = await Promise.all([
    supabase.from('products').select('id, product_name, brand').order('created_at', { ascending: false }),
    supabase.from('ideas').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('scripts').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('storyboards').select('*').order('created_at', { ascending: false }).limit(100)
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content Library</h1>
        <p className="text-gray-500">ค้นหา/กรอง Idea, Script, Storyboard ทั้งหมดที่เคยสร้าง — เลือก &ldquo;ใช้ต่อ&rdquo; เพื่อกลับไปทำงานต่อใน Creative Generator</p>
      </div>

      <ContentLibraryClient
        products={products ?? []}
        ideas={ideas ?? []}
        scripts={scripts ?? []}
        storyboards={storyboards ?? []}
      />
    </div>
  );
}
