'use client';

import { useMemo, useState } from 'react';
import type { Product } from '@/types/database';
import { HOOK_CATEGORIES, HOOK_LIBRARY_TOTAL, HOOK_VOICES, type HookCategory } from '@/prompts/hook-library';

// Hook Generator — standalone page over the same library + AI adapt action
// the AI Video Prompt Studio "Hook" step uses (prompts/hook-library.ts,
// POST /api/video-prompt-studio/generate { action: 'hooks' }).
// Output is copy-paste text — nothing is saved to the database from here.

interface AiHook {
  text: string;
  angle: string;
}

type SlotFilter = 'all' | 'opening' | 'closing';

const SLOT_LABEL: Record<HookCategory['position'], string> = {
  opening: 'เปิดคลิป',
  closing: 'ปิดการขาย',
  both: 'เปิด/ปิดได้'
};

export default function HookGeneratorClient({ products }: { products: Pick<Product, 'id' | 'product_name' | 'brand'>[] }) {
  const [productId, setProductId] = useState('');
  const [voice, setVoice] = useState<string>(HOOK_VOICES[0]);
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all');
  const [categoryId, setCategoryId] = useState(HOOK_CATEGORIES[0].id);
  const [search, setSearch] = useState('');
  const [count, setCount] = useState(5);
  const [aiHooks, setAiHooks] = useState<AiHook[]>([]);
  const [aiMeta, setAiMeta] = useState<{ categoryLabel: string; hasProduct: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const visibleCategories = useMemo(
    () => HOOK_CATEGORIES.filter((c) => slotFilter === 'all' || c.position === slotFilter || c.position === 'both'),
    [slotFilter]
  );
  const category = visibleCategories.find((c) => c.id === categoryId) ?? visibleCategories[0];

  // Search runs across every สาย (ignores the selected one) so a keyword
  // like "ราคา" or "ตะกร้า" finds lines wherever they live.
  const keyword = search.trim();
  const searchResults = useMemo(() => {
    if (!keyword) return [];
    return HOOK_CATEGORIES.flatMap((c) => c.hooks.filter((h) => h.includes(keyword)).map((h) => ({ text: h, categoryLabel: c.label })));
  }, [keyword]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 1500);
    } catch {
      setError('Copy ไม่สำเร็จ — เลือกข้อความแล้ว copy เองได้');
    }
  }

  async function askAi() {
    setLoading(true);
    setError('');
    try {
      // 'both' สาย can be used either way; treat them as closing lines only
      // when the user is explicitly filtering for closers.
      const slot = category.position === 'closing' || (category.position === 'both' && slotFilter === 'closing') ? 'closing' : 'opening';
      const res = await fetch('/api/video-prompt-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hooks', product_id: productId || null, category_id: category.id, slot, count, voice })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ให้ AI คิด Hook ไม่สำเร็จ');
      setAiHooks(json.hooks ?? []);
      setAiMeta({ categoryLabel: category.label, hasProduct: !!json.has_product });
    } catch (e: any) {
      setError(e?.message || 'ให้ AI คิด Hook ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">สินค้า (ใช้ตอนให้ AI ปรับ)</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">— ไม่ระบุสินค้า —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">เสียงผู้พูด</label>
            <select value={voice} onChange={(e) => setVoice(e.target.value)}>
              {HOOK_VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">ตำแหน่งในคลิป</label>
            <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value as SlotFilter)}>
              <option value="all">ทุกสาย</option>
              <option value="opening">เปิดคลิป (3 วินาทีแรก)</option>
              <option value="closing">ปิดการขายท้ายคลิป</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">สาย Hook ({visibleCategories.length} สาย)</label>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} aria-pressed={c.id === category.id} className={c.id === category.id ? 'btn-primary' : 'btn-secondary'}>
                {c.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {category.label} · {SLOT_LABEL[category.position]} · Funnel: {category.funnel}
          </p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="card p-5 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">ให้ AI คิด Hook ตามสินค้า</h2>
            <p className="text-sm text-gray-500">ใช้ 20 ประโยคของสาย “{category.label}” เป็นตัวอย่าง แล้วเขียนใหม่จากข้อมูลสินค้าจริงใน Products</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="field-label">จำนวน</label>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
            <button type="button" className="btn-primary" onClick={askAi} disabled={loading}>
              {loading ? 'AI กำลังคิด...' : 'ให้ AI คิด Hook'}
            </button>
          </div>
        </div>

        {aiHooks.length > 0 && aiMeta && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-500">ผลลัพธ์จากสาย “{aiMeta.categoryLabel}”</p>
              <button type="button" className="btn-secondary" onClick={() => copy(aiHooks.map((h) => h.text).join('\n'), 'ai-all')}>
                {copiedKey === 'ai-all' ? '✓ Copy แล้ว' : 'Copy ทั้งหมด'}
              </button>
            </div>
            {!aiMeta.hasProduct && <p className="text-xs text-amber-600">⚠ ไม่ได้เลือกสินค้า — AI เขียนแบบกลาง ๆ ไม่ได้อิงข้อมูลสินค้าจริง</p>}
            {aiHooks.map((h, i) => (
              <div key={`${i}-${h.text}`} className="flex items-start justify-between gap-3 rounded-md border border-border bg-white px-3 py-2">
                <div className="text-sm">
                  <p>{h.text}</p>
                  {h.angle && <p className="text-xs text-gray-500">มุม: {h.angle}</p>}
                </div>
                <button type="button" className="text-xs text-accentBlue whitespace-nowrap" onClick={() => copy(h.text, `ai-${i}`)}>
                  {copiedKey === `ai-${i}` ? '✓ Copy แล้ว' : 'Copy'}
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-500">
              AI ถูกสั่งไม่ให้ใส่ราคา ส่วนลด หรือเคลมที่ไม่มีในข้อมูลสินค้า — แต่ยังต้องอ่านทวนก่อนใช้จริงทุกครั้ง โดยเฉพาะคำเคลมสรรพคุณ
            </p>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">คลัง {HOOK_LIBRARY_TOTAL} Hook</h2>
            <p className="text-sm text-gray-500">{keyword ? `ผลค้นหา “${keyword}” จากทุกสาย — ${searchResults.length} ประโยค` : `สาย “${category.label}” — ${category.hooks.length} ประโยค`}</p>
          </div>
          <div className="w-full sm:w-64">
            <label className="field-label">ค้นหาในคลังทั้งหมด</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="เช่น ราคา, ตะกร้า, คุ้ม" />
          </div>
        </div>

        <div className="space-y-1">
          {(keyword ? searchResults : category.hooks.map((h) => ({ text: h, categoryLabel: '' }))).map((h, i) => (
            <div key={`${h.categoryLabel}-${i}-${h.text}`} className="flex items-start justify-between gap-3 rounded-md border border-border bg-white px-3 py-2">
              <div className="text-sm">
                <p>{h.text}</p>
                {h.categoryLabel && <p className="text-xs text-gray-500">สาย: {h.categoryLabel}</p>}
              </div>
              <button type="button" className="text-xs text-accentBlue whitespace-nowrap" onClick={() => copy(h.text, `lib-${h.categoryLabel}-${i}`)}>
                {copiedKey === `lib-${h.categoryLabel}-${i}` ? '✓ Copy แล้ว' : 'Copy'}
              </button>
            </div>
          ))}
          {keyword && searchResults.length === 0 && <p className="text-sm text-gray-500">ไม่พบประโยคที่มีคำนี้</p>}
        </div>
      </div>
    </div>
  );
}
