import { createClient } from '@/lib/supabase/server';
import BannerGeneratorClient from '@/components/banner-generator-client';

export default async function BannerGeneratorPage() {
  const supabase = createClient();
  const { data: history } = await supabase
    .from('banner_generator_jobs')
    .select('id, product_name, template, image_count, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">สร้างภาพโฆษณา AI (Banner Generator)</h1>
        <p className="text-gray-500">
          เลือกแนวภาพ แนบภาพสินค้าจริง ระบุจำนวน (สูงสุด 10 ภาพต่อครั้ง) แล้วให้ OpenAI สร้างภาพโฆษณาพร้อมใช้ — ใช้เทมเพลต
          Prompt ชุดเดียวกับที่ทีมครีเอทีฟใช้จริง
        </p>
      </div>
      <BannerGeneratorClient history={history ?? []} />
    </div>
  );
}
