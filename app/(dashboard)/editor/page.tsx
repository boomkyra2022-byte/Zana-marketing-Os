import { createClient } from '@/lib/supabase/server';
import EditorClient from '@/components/editor-client';

export default async function EditorPage() {
  const supabase = createClient();
  const [{ data: products }, { data: recentJobs }] = await Promise.all([
    supabase.from('products').select('id, product_name, brand').order('created_at', { ascending: false }),
    supabase
      .from('editor_jobs')
      .select('id, operation, status, result_kind, created_at, error')
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Editor</h1>
        <p className="text-gray-500">
          ตัดช่วงเงียบ / เบิร์นซับลงคลิป / ถอด SRT / ลบลายน้ำ AI — ประมวลผลผ่าน Tamsub วางลิงก์ Google Drive หรือ URL วิดีโอโดยตรง
          (ไม่รองรับอัปโหลดไฟล์ตรงจากเครื่อง เพราะข้อจำกัดขนาดไฟล์ของเซิร์ฟเวอร์)
        </p>
        <p className="text-gray-500 mt-1">
          &quot;SRT แบบ Punchy&quot; ไม่ผ่าน Tamsub — ถอดเสียงด้วย Whisper (เวลาจริงต่อคำ) แล้วให้ AI แบ่งเป็นซับสั้นๆ ตามกฎภาษาไทยที่กำหนด
          (ไม่ตัดคำเฉลี่ยเวลา, รวมคำเชื่อมกับคำหลัก, ไม่เว้นวรรคทุกคำ) เหมาะเอาไฟล์ .srt ไปนำเข้า CapCut เอง
        </p>
      </div>
      <EditorClient products={products ?? []} recentJobs={recentJobs ?? []} />
    </div>
  );
}
