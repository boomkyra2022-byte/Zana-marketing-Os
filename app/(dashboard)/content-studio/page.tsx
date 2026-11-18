import { createClient } from '@/lib/supabase/server';
import ContentStudioClient from '@/components/content-studio-client';
import type { StudioClient, StudioPost } from '@/types/database';

// Content Studio — JANGZANA per-client content library (migration 0032).
export default async function ContentStudioPage() {
  const supabase = createClient();
  const [clients, posts] = await Promise.all([
    supabase.from('studio_clients').select('*').order('name', { ascending: true }),
    supabase.from('studio_posts').select('*').order('created_at', { ascending: false }).limit(2000)
  ]);
  const error = clients.error || posts.error;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content Studio</h1>
        <p className="text-gray-500">
          คลังคอนเทนต์แยกตามลูกค้าจ้างซาน่า — กรอก Brand Card ครั้งเดียว แล้วสร้างคอนเทนต์ตามจุดยืนและสไตล์ของลูกค้ารายนั้นได้ทุกวัน
        </p>
      </div>
      {error && (
        <div className="card p-4 mb-4 border-red-300 text-red-700 text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
          {/relation .* does not exist/i.test(error.message) && ' — ยังไม่ได้รัน migration 0032_content_studio.sql ใน Supabase SQL Editor'}
        </div>
      )}
      <ContentStudioClient initialClients={(clients.data ?? []) as StudioClient[]} initialPosts={(posts.data ?? []) as StudioPost[]} />
    </div>
  );
}
