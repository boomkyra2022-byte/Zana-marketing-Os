import { createClient } from '@/lib/supabase/server';
import VideoPromptStudioClient from '@/components/video-prompt-studio-client';

export default async function VideoPromptStudioPage() {
  const supabase = createClient();
  const [{ data: products }, { data: modelPresets }, { data: presets }] = await Promise.all([
    supabase.from('products').select('id, product_name, brand, category').order('created_at', { ascending: false }),
    supabase.from('model_presets').select('id, name, type, identity_lock, reference_images, master_reference').eq('active', true).order('created_at', { ascending: false }),
    supabase.from('video_prompt_presets').select('*').order('is_system_default', { ascending: false }).order('created_at', { ascending: false })
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Video Prompt Studio</h1>
        <p className="text-gray-500">
          ประกอบ Master Prompt วิดีโอจากตัวเลือกที่กำหนดเอง แล้ว copy ไปวางใน Google Flow / Veo / Runway ได้ทันที — ไม่ต้องเขียน Prompt เองใหม่ทุกครั้ง
        </p>
      </div>
      <VideoPromptStudioClient products={products ?? []} modelPresets={modelPresets ?? []} presets={presets ?? []} />
    </div>
  );
}
