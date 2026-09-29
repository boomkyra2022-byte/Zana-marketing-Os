import { createClient } from '@/lib/supabase/server';
import PromptLibraryClient from '@/components/prompt-library-client';

export default async function PromptLibraryPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('prompt_library')
    .select('*')
    .order('group_name', { ascending: true })
    .order('sort_order', { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Prompt Library</h1>
        <p className="text-gray-500">
          คลัง prompt สำหรับงานวิดีโอ/ภาพ AI — กรอกค่าในช่อง [ ] แล้วกดคัดลอกไปใช้ได้ทันที เก็บสะสมไว้ใช้ซ้ำ ปรับแต่ง หรือเพิ่มของตัวเองได้ตลอด
        </p>
      </div>

      {error && <div className="card p-4 mb-4 border-red-300 text-red-700 text-sm">โหลดข้อมูลไม่สำเร็จ: {error.message}</div>}

      <PromptLibraryClient initialPrompts={data ?? []} />
    </div>
  );
}
