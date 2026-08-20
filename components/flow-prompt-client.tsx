'use client';

import { useState } from 'react';

interface Props {
  products: { id: string; product_name: string; brand: string; usp: string | null }[];
  recentSets: { id: string; video_concept: string | null; inputs: any; created_at: string }[];
}

const PLATFORM_OPTIONS = ['TikTok', 'Facebook Reels', 'Instagram Reels', 'YouTube Shorts', 'Marketplace'];

interface Scene {
  scene_number: number;
  purpose: string;
  duration_sec: number;
  prompt_text: string;
}

interface FlowPromptResult {
  id: string;
  video_concept: string;
  video_flow: { scene_number: number; purpose: string }[];
  scenes: Scene[];
}

export default function FlowPromptClient({ products, recentSets }: Props) {
  const [productId, setProductId] = useState('');
  const [product, setProduct] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [contentBrief, setContentBrief] = useState('');
  const [character, setCharacter] = useState('');
  const [sceneCount, setSceneCount] = useState(4);
  const [sceneDuration, setSceneDuration] = useState(8);
  const [visualStyle, setVisualStyle] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [cta, setCta] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FlowPromptResult | null>(null);
  const [copiedScene, setCopiedScene] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  function handleProductChange(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setProduct(`${p.brand} — ${p.product_name}`);
      if (p.usp) setProductDescription(p.usp);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/tools/flow-prompt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId || null,
          product,
          product_description: productDescription || undefined,
          objective,
          target_audience: targetAudience || undefined,
          content_brief: contentBrief,
          character: character || undefined,
          scene_count: sceneCount,
          scene_duration: sceneDuration,
          visual_style: visualStyle || undefined,
          platform,
          cta: cta || undefined,
          additional_notes: additionalNotes || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
      const fp = json.flow_prompt;
      setResult({ id: fp.id, video_concept: fp.video_concept, video_flow: fp.video_flow, scenes: fp.scenes });
    } catch (err: any) {
      setError(err.message || 'สร้าง Prompt ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(id: string) {
    setHistoryLoading(id);
    setError('');
    try {
      const res = await fetch(`/api/tools/flow-prompt/generate?id=${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const fp = json.flow_prompt;
      setResult({ id: fp.id, video_concept: fp.video_concept, video_flow: fp.video_flow, scenes: fp.scenes });
    } catch (err: any) {
      setError(err.message || 'โหลดไม่สำเร็จ');
    } finally {
      setHistoryLoading(null);
    }
  }

  function copyPrompt(scene: Scene) {
    navigator.clipboard.writeText(scene.prompt_text).then(() => {
      setCopiedScene(scene.scene_number);
      setTimeout(() => setCopiedScene(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Brief</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">เลือกสินค้า (ไม่บังคับ — ช่วย prefill ให้)</label>
            <select value={productId} onChange={(e) => handleProductChange(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Platform *</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Product / Service *</label>
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="ชื่อสินค้า/บริการ" />
          </div>
          <div>
            <label className="field-label">Video Objective *</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="เช่น เพิ่มยอดขาย, สร้าง awareness" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Product Description</label>
            <textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)} rows={2} />
          </div>
          <div className="col-span-2">
            <label className="field-label">Target Audience</label>
            <textarea value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} rows={2} placeholder="เพศ/อายุ/pain/desire" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Rough Content / Message *</label>
            <textarea value={contentBrief} onChange={(e) => setContentBrief(e.target.value)} rows={3} placeholder="เนื้อหาคร่าวๆ ที่อยากสื่อ" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Character / Source Footage</label>
            <textarea
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
              rows={2}
              placeholder="เช่น มีคลิปคนพูดต้นฉบับอยู่แล้ว ต้องคง lip sync — หรือเว้นว่างถ้าให้ AI คิดเอง"
            />
          </div>
          <div>
            <label className="field-label">จำนวน Scene *</label>
            <input type="number" min={1} max={12} value={sceneCount} onChange={(e) => setSceneCount(parseInt(e.target.value, 10) || 1)} />
          </div>
          <div>
            <label className="field-label">ความยาวต่อ Scene (วินาที) *</label>
            <input type="number" min={3} max={60} value={sceneDuration} onChange={(e) => setSceneDuration(parseInt(e.target.value, 10) || 8)} />
          </div>
          <div>
            <label className="field-label">Video Style</label>
            <input value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} placeholder="เช่น cinematic, UGC, corporate clean" />
          </div>
          <div>
            <label className="field-label">CTA</label>
            <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="เช่น กดสั่งซื้อลิงก์ในไบโอ" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Additional Requirements</label>
            <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <button className="btn-primary" disabled={loading || !product || !objective || !contentBrief} onClick={handleGenerate}>
          {loading ? 'กำลังสร้าง Prompt...' : 'Generate Prompts'}
        </button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </div>

      {result && (
        <>
          <div className="card p-6 space-y-3">
            <h3 className="font-semibold">Video Concept</h3>
            <p className="text-sm text-gray-700">{result.video_concept}</p>
            <div className="pt-2 border-t border-border">
              <div className="field-label m-0 mb-1">Video Flow</div>
              <ol className="list-decimal list-inside text-sm space-y-1">
                {result.video_flow.map((f) => (
                  <li key={f.scene_number}>
                    Scene {f.scene_number} → {f.purpose}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {result.scenes.map((scene) => (
            <div key={scene.scene_number} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Scene {scene.scene_number} — {scene.purpose}
                </h3>
                <span className="text-xs text-gray-500">{scene.duration_sec}s</span>
              </div>
              <textarea readOnly value={scene.prompt_text} rows={10} className="w-full font-mono text-xs" />
              <button className="btn-secondary" onClick={() => copyPrompt(scene)}>
                {copiedScene === scene.scene_number ? '✓ คัดลอกแล้ว' : 'Copy Prompt'}
              </button>
            </div>
          ))}
        </>
      )}

      <div className="card p-4">
        <h3 className="font-semibold mb-3">ประวัติล่าสุด</h3>
        {recentSets.length === 0 ? (
          <p className="text-gray-500 text-sm">ยังไม่มีประวัติ</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-gray-500">
              <tr>
                <th className="px-2 py-2">Concept</th>
                <th className="px-2 py-2">เวลา</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {recentSets.map((s) => (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="px-2 py-2 max-w-md">{s.video_concept ?? s.inputs?.product ?? '(ไม่มีชื่อ)'}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-500">{new Date(s.created_at).toLocaleString('th-TH')}</td>
                  <td className="px-2 py-2">
                    <button className="text-accentBlue text-xs" disabled={historyLoading === s.id} onClick={() => loadHistory(s.id)}>
                      {historyLoading === s.id ? '...' : 'เปิดดู'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
