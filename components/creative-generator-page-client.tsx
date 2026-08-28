'use client';

import { useState } from 'react';
import CreativeGeneratorClient from '@/components/creative-generator-client';
import BannerGeneratorClient from '@/components/banner-generator-client';

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

type PageTab = 'pipeline' | 'banner';

interface Props {
  products: { id: string; product_name: string; brand: string }[];
  personas: { id: string; name: string }[];
  bannerHistory: { id: string; product_name: string; template: string; image_count: number; created_at: string }[];
}

export default function CreativeGeneratorPageClient({ products, personas, bannerHistory }: Props) {
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
      </div>

      {tab === 'pipeline' ? (
        <CreativeGeneratorClient products={products} personas={personas} />
      ) : (
        <BannerGeneratorClient history={bannerHistory} />
      )}
    </div>
  );
}
