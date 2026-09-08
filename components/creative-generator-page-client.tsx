'use client';

import { useState } from 'react';
import CreativeGeneratorClient from '@/components/creative-generator-client';
import BannerGeneratorClient from '@/components/banner-generator-client';
import CaptionGeneratorClient from '@/components/caption-generator-client';
import VisualHookBannerClient from '@/components/visual-hook-banner-client';

// Explicit user request: "เพิ่มลงในหน้านี้ได้ไหม
// https://os.zanadynasty.site/creative-generator ทำเป็นอีก 1 หัวข้อ" — the
// Banner/Ads Image Generator (built as its own standalone page/route first)
// is now ALSO reachable as a second tab on the Creative Generator page,
// right next to the existing Idea → Script → Storyboard pipeline. Kept as
// two separate top-level components (not merged into the 3-step wizard's
// own state machine) since a banner image isn't a 4th sequential step in
// that pipeline — it's an independent tool a user might reach for on its
// own, same relationship the Idea/Script/Storyboard steps already have to
// each other conceptually, just not chained the same way.
//
// The route /banner-generator (app/(dashboard)/banner-generator/page.tsx)
// still works standalone too — this tab renders the exact same client
// component, not a copy, so there's only one implementation to maintain.
//
// Restructured into 5 "Mode" tabs — explicit follow-up spec: "โปรดอัปเกรด
// Creative Generator... เพิ่ม Mode ด้านบน... อย่าลบ Workflow เดิม". Nothing
// existing was removed, only relabeled/regrouped under the Mode naming:
// - "Content & Video" = the original Idea→Script→Storyboard pipeline
// - "Visual Hook Banner" = the ONE new mode built fully (Creative Brief →
//   AI Visual Ideas → Prompt Studio → Generation Destination), per the
//   user's own explicit choice when asked which of the 5 to build first —
//   the other new-workflow modes weren't attempted yet rather than being
//   faked, to avoid shipping dead buttons.
// - "Ads Banner" = the original Banner/Ads Image Generator, unchanged
// - "E-Commerce Image" / "Reels / Video Prompt" = honestly marked
//   not-yet-available rather than reusing Ads Banner's UI under a new label
//   (that would silently promise a workflow — Creative Brief, funnel-aware
//   ideas, etc. — this tab doesn't actually run)
// - "คิดแคปชั่น" = unchanged, kept after the 5 Modes per spec

type PageTab = 'pipeline' | 'visual_hook_banner' | 'banner' | 'ecommerce_image' | 'reels_video' | 'caption';

interface ProductRecord {
  id: string;
  product_name: string;
  brand: string;
  category?: string | null;
  usp?: string | null;
  ingredients?: string | null;
  benefits?: string | null;
  usage?: string | null;
  allowed_claims?: string | null;
  banned_claims?: string | null;
  compliance_notes?: string | null;
  selling_price?: number | null;
  promotion_price?: number | null;
}

interface KnowledgeItemRecord {
  id: string;
  title: string;
  type: string;
  content: string;
  product_ids?: string[] | null;
}

interface Props {
  products: ProductRecord[];
  personas: { id: string; name: string }[];
  bannerHistory: { id: string; product_name: string; template: string; image_count: number; created_at: string }[];
  knowledgeItems: KnowledgeItemRecord[];
  recentIdeas: any[];
  recentScripts: any[];
  recentStoryboards: any[];
  initialIdea: any | null;
  initialScript: any | null;
}

export default function CreativeGeneratorPageClient({
  products,
  personas,
  bannerHistory,
  knowledgeItems,
  recentIdeas,
  recentScripts,
  recentStoryboards,
  initialIdea,
  initialScript
}: Props) {
  const [tab, setTab] = useState<PageTab>('pipeline');

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        <button type="button" className={`btn-secondary ${tab === 'pipeline' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('pipeline')}>
          1. Content & Video
        </button>
        <button type="button" className={`btn-secondary ${tab === 'visual_hook_banner' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('visual_hook_banner')}>
          2. Visual Hook Banner
        </button>
        <button type="button" className={`btn-secondary ${tab === 'banner' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('banner')}>
          3. Ads Banner
        </button>
        <button type="button" className={`btn-secondary ${tab === 'ecommerce_image' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('ecommerce_image')}>
          4. E-Commerce Image
        </button>
        <button type="button" className={`btn-secondary ${tab === 'reels_video' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('reels_video')}>
          5. Reels / Video Prompt
        </button>
        <button type="button" className={`btn-secondary ${tab === 'caption' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setTab('caption')}>
          คิดแคปชั่น
        </button>
      </div>

      {tab === 'pipeline' && (
        <CreativeGeneratorClient
          products={products}
          personas={personas}
          recentIdeas={recentIdeas}
          recentScripts={recentScripts}
          recentStoryboards={recentStoryboards}
          initialIdea={initialIdea}
          initialScript={initialScript}
        />
      )}
      {tab === 'visual_hook_banner' && <VisualHookBannerClient products={products} />}
      {tab === 'banner' && <BannerGeneratorClient history={bannerHistory} products={products} knowledgeItems={knowledgeItems} />}
      {tab === 'caption' && <CaptionGeneratorClient products={products} personas={personas} />}
      {(tab === 'ecommerce_image' || tab === 'reels_video') && (
        <div className="card p-8 text-center text-gray-500 space-y-2">
          <div className="text-lg font-semibold text-gray-600">Mode นี้ยังไม่เปิดใช้งาน</div>
          <div className="text-sm">
            {tab === 'ecommerce_image' ? 'E-Commerce Image' : 'Reels / Video Prompt'} อยู่ในแผน Phase ถัดไป — ตอนนี้ระบบสร้าง Workflow ใหม่
            (Creative Brief → AI Visual Ideas → Prompt Studio → Generate/Export) เต็มรูปแบบให้เฉพาะ <b>Visual Hook Banner</b> ก่อน ตามที่เลือกไว้
          </div>
        </div>
      )}
    </div>
  );
}
