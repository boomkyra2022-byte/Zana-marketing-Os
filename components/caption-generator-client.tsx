'use client';

import { useState } from 'react';

// Standalone Caption Generator tab — explicit user request: "ในช่องด้านบน
// ตัวเลือกข้าง → สร้างภาพโฆษณา ให้เพิ่ม → คิดแคปชั่น Caption" (add a Caption
// tab next to the Ads Image Generator tab on /creative-generator). Quick
// ideation tool: pick a product, optionally a persona/framework/brief, get N
// distinct ready-to-post caption options with hashtags and a Copy button —
// no need to run the full Idea → Script pipeline just to get captions.

interface ProductOption {
  id: string;
  product_name: string;
  brand: string;
}

interface PersonaOption {
  id: string;
  name: string;
}

interface CaptionResult {
  hook: string;
  caption: string;
  hashtags: string[];
  angle?: string | null;
}

interface Props {
  products: ProductOption[];
  personas: PersonaOption[];
}

const QTY_PRESETS = [3, 5, 10];
const FRAMEWORK_OPTIONS: { value: 'STANDARD' | 'ZANA'; label: string }[] = [
  { value: 'STANDARD', label: 'Standard (เปิดอิสระ)' },
  { value: 'ZANA', label: 'ZANA Framework' }
];

export default function CaptionGeneratorClient({ products, personas }: Props) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [personaId, setPersonaId] = useState('');
  const [framework, setFramework] = useState<'STANDARD' | 'ZANA'>('STANDARD');
  const [objective, setObjective] = useState('');
  const [platform, setPlatform] = useState('');
  const [promotion, setPromotion] = useState('');
  const [brief, setBrief] = useState('');
  const [qty, setQty] = useState(5);
  const [qtyCustom, setQtyCustom] = useState('');
  const [results, setResults] = useState<CaptionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const effectiveQty = qtyCustom ? parseInt(qtyCustom, 10) || 0 : qty;
  const isZana = framework === 'ZANA';

  async function handleGenerate() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/creative/captions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          persona_id: personaId || null,
          quantity: effectiveQty,
          framework,
          objective: objective || undefined,
          platform: platform || undefined,
          promotion: promotion || undefined,
          brief: brief || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generate captions failed');
      setResults(json.captions as CaptionResult[]);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  function copyCaption(r: CaptionResult, i: number) {
    const text = r.hashtags && r.hashtags.length > 0 ? `${r.caption}\n\n${r.hashtags.map((h) => `#${h}`).join(' ')}` : r.caption;
    navigator.clipboard.writeText(text);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex((cur) => (cur === i ? null : cur)), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">คิดแคปชั่น — Caption Generator</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">สินค้า *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.length === 0 && <option value="">— ยังไม่มีสินค้า —</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Persona (ไม่บังคับ)</label>
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Framework</label>
            <select value={framework} onChange={(e) => setFramework(e.target.value as 'STANDARD' | 'ZANA')}>
              {FRAMEWORK_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {isZana && (
              <div
                className="mt-2 text-xs rounded-lg p-2.5"
                style={{ background: 'var(--accent-strategy-tint)', color: 'var(--text-main)', border: '1px solid var(--accent-strategy)' }}
              >
                <span className="font-semibold" style={{ color: 'var(--accent-strategy)' }}>
                  Hook → Problem → Agitate → Bridge → Solution → Proof → CTA
                </span>{' '}
                — แคปชั่นจะเริ่มจาก Pain จริงก่อนพาสินค้าเข้ามาแก้ปัญหาอย่างเป็นธรรมชาติ
              </div>
            )}
          </div>
          <div>
            <label className="field-label">Platform (ไม่บังคับ)</label>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="เช่น TikTok, Facebook, Instagram" />
          </div>
          <div>
            <label className="field-label">Objective (ไม่บังคับ)</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="เช่น เพิ่มยอดขายโปรโมชั่นใหม่" />
          </div>
          <div>
            <label className="field-label">Promotion / Offer (ไม่บังคับ)</label>
            <input value={promotion} onChange={(e) => setPromotion(e.target.value)} placeholder="เช่น ลด 20% วันนี้เท่านั้น" />
          </div>
        </div>

        <div>
          <label className="field-label">Brief เพิ่มเติม (ไม่บังคับ)</label>
          <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="รายละเอียดเพิ่มเติมที่อยากให้ AI รู้..." />
        </div>

        <div>
          <label className="field-label">จำนวนแคปชั่น</label>
          <div className="flex gap-2 items-center flex-wrap">
            {QTY_PRESETS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setQty(q);
                  setQtyCustom('');
                }}
                className={qty === q && !qtyCustom ? 'btn-primary' : 'btn-secondary'}
              >
                {q}
              </button>
            ))}
            <input className="!w-24" placeholder="กำหนดเอง" value={qtyCustom} onChange={(e) => setQtyCustom(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button className="btn-primary" disabled={!productId || effectiveQty < 1 || loading} onClick={handleGenerate}>
          {loading ? 'กำลังคิดแคปชั่น...' : `คิด ${effectiveQty || ''} แคปชั่น`}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">ผลลัพธ์ ({results.length})</h3>
          {results.map((r, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {r.angle && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-gray-500">{r.angle}</span>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap">{r.caption}</div>
              {r.hashtags && r.hashtags.length > 0 && <div className="text-xs text-accentBlue">{r.hashtags.map((h) => `#${h}`).join(' ')}</div>}
              <button type="button" className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => copyCaption(r, i)}>
                {copiedIndex === i ? '✓ Copied' : '📋 Copy Caption'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
