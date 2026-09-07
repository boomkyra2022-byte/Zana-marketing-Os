'use client';

import { useState } from 'react';
import CreativeGeneratorClient from '@/components/creative-generator-client';
import BannerGeneratorClient from '@/components/banner-generator-client';
import CaptionGeneratorClient from '@/components/caption-generator-client';

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

type PageTab = 'pipeline' | 'banner' | 'caption';

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
        <button
          type="button"
          className={`btn-secondary ${tab === 'pipeline' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setTab('pipeline')}
        >
          Idea → Script → Storyboard
        </button>
        <button
          type="button"
          className={`btn-secondary ${tab === 'banner' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setTab('banner')}
        >
          สร้างภาพโฆษณา AI
        </button>
        <button
          type="button"
          className={`btn-secondary ${tab === 'caption' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setTab('caption')}
        >
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
      {tab === 'banner' && <BannerGeneratorClient history={bannerHistory} products={products} knowledgeItems={knowledgeItems} />}
      {tab === 'caption' && <CaptionGeneratorClient products={products} personas={personas} />}
    </div>
  );
}
