'use client';

import { useMemo, useState } from 'react';
import { hookCategoriesFor, type HookCategory } from '@/prompts/hook-library';

// Shared Hook picker — one slot (opening hook OR closing line).
// Library mode: pick / shuffle one of the สาย's 20 lines (no AI call, free).
// AI mode: POST action 'hooks' to /api/video-prompt-studio/generate, which
// rewrites the สาย's lines around the selected product's real facts.
// The chosen line always lands in an editable textarea — the user has the
// last word on the copy before it is locked into the Master Prompt.

interface AiHook {
  text: string;
  angle: string;
}

export default function HookPicker({
  slot,
  title,
  hint,
  productId,
  voice,
  categoryId,
  onCategoryChange,
  value,
  onChange
}: {
  slot: 'opening' | 'closing';
  title: string;
  hint?: string;
  productId: string;
  voice: string;
  categoryId: string;
  onCategoryChange: (id: string) => void;
  value: string;
  onChange: (text: string) => void;
}) {
  const categories = useMemo(() => hookCategoriesFor(slot), [slot]);
  const category: HookCategory = categories.find((c) => c.id === categoryId) ?? categories[0];

  const [aiHooks, setAiHooks] = useState<AiHook[]>([]);
  const [aiForCategory, setAiForCategory] = useState('');
  const [aiHadProduct, setAiHadProduct] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function shuffle() {
    const pool = category.hooks.filter((h) => h !== value);
    onChange(pool[Math.floor(Math.random() * pool.length)]);
  }

  async function askAi() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/video-prompt-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hooks', product_id: productId || null, category_id: category.id, slot, count: 5, voice })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ให้ AI คิด Hook ไม่สำเร็จ');
      setAiHooks(json.hooks ?? []);
      setAiForCategory(category.id);
      setAiHadProduct(!!json.has_product);
    } catch (e: any) {
      setError(e?.message || 'ให้ AI คิด Hook ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  const showAi = aiHooks.length > 0 && aiForCategory === category.id;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div>
          <label className="field-label">สาย Hook</label>
          <select value={category.id} onChange={(e) => onCategoryChange(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} · {c.funnel}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-secondary" onClick={shuffle}>
          สุ่มจากคลัง
        </button>
        <button type="button" className="btn-primary" onClick={askAi} disabled={loading}>
          {loading ? 'AI กำลังคิด...' : 'ให้ AI ปรับตามสินค้า'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showAi && (
        <div>
          <label className="field-label">AI ปรับให้แล้ว — กดเพื่อเลือก</label>
          {!aiHadProduct && <p className="text-xs text-amber-600 mb-1">⚠ ยังไม่ได้เลือกสินค้าใน Step 1 — AI เขียนแบบกลาง ๆ ไม่ได้อิงข้อมูลสินค้าจริง</p>}
          <div className="space-y-1">
            {aiHooks.map((h, i) => (
              <button
                key={`${i}-${h.text}`}
                type="button"
                onClick={() => onChange(h.text)}
                aria-pressed={h.text === value}
                className={`block w-full text-left rounded-md border px-3 py-2 text-sm ${h.text === value ? 'border-accentBlue bg-white font-semibold' : 'border-border bg-white'}`}
              >
                <span>{h.text}</span>
                {h.angle && <span className="block text-xs text-gray-500">มุม: {h.angle}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="field-label">คลัง “{category.label}” — กดเพื่อเลือก</label>
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {category.hooks.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onChange(h)}
              aria-pressed={h === value}
              className={`block w-full text-left rounded-md border px-3 py-1.5 text-sm ${h === value ? 'border-accentBlue bg-white font-semibold' : 'border-border bg-white'}`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label">ประโยคที่จะใช้ (แก้คำเองได้)</label>
        <textarea rows={2} maxLength={300} value={value} onChange={(e) => onChange(e.target.value)} placeholder="ยังไม่ได้เลือก — เว้นว่างได้ ระบบจะให้เครื่องมือวิดีโอคิดเอง" className="w-full" />
        {value && (
          <button type="button" className="text-xs text-gray-500 underline mt-1" onClick={() => onChange('')}>
            ล้างประโยคนี้
          </button>
        )}
      </div>
    </div>
  );
}
