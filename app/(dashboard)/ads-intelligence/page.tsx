import { createClient } from '@/lib/supabase/server';
import AdsIntelligenceClient from '@/components/ads-intelligence/ads-intelligence-client';

// Ads Intelligence — ZANA's own Dashboard / Ad Spotlight / Creative Fatigue /
// Video Ads analysis on live Meta data (read-only). Built after reviewing
// MaxxGPT's equivalent pages (user request 2026-11-14) so the team doesn't
// need that subscription; logic and wording are ZANA's own.
export default async function AdsIntelligencePage() {
  const supabase = createClient();
  const { data } = await supabase.from('ad_accounts').select('meta_account_id, name, status').order('name');
  const accounts = (data ?? [])
    .filter((a: any) => a.status !== 'disabled')
    .map((a: any) => ({ metaAccountId: String(a.meta_account_id), name: String(a.name) }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ads Intelligence</h1>
        <p className="text-gray-500">ดึงข้อมูลโฆษณา Meta แบบอ่านอย่างเดียว แล้ววิเคราะห์ภาพรวม โฆษณาที่ควรเพิ่มงบ/ปิด ครีเอทีฟที่เริ่มล้า และ funnel คลิปวิดีโอ</p>
      </div>
      <AdsIntelligenceClient accounts={accounts} />
    </div>
  );
}
