'use client';

import { useState } from 'react';
import type { VisualIdea, PromptStudioBlockState, PromptStudioPreset, ModelPreset } from '@/types/database';
import {
  PROMPT_STUDIO_BLOCK_DEFS,
  seedPromptStudioBlocks,
  assembleBlocksText,
  formatPromptForProvider,
  buildFinalImagePrompt,
  type PromptProvider
} from '@/prompts/visual-hook-banner';

// Visual Hook Banner mode — Creative Brief -> AI Visual Ideas -> Prompt
// Studio -> Generation Destination workflow (explicit user spec). Scoped per
// the user's own choice: this is the ONE mode built fully. Model+Product
// Library upgrade (later spec): Model Identity is now a real picker backed
// by the Model Library (with a free-text fallback that still works exactly
// as before), and "Generate Inside ZANA OS" uses the selected Model's real
// reference photos / the selected Product's real packshots via OpenAI
// image-to-image (editImages) when available — a genuine effect on the
// pixels, not just prompt text. Every other provider stays honestly
// export-only, never a fake "Generate" button.

interface ProductOption {
  id: string;
  product_name: string;
  brand: string;
}

interface ModelOption {
  id: string;
  name: string;
  type: ModelPreset['type'];
  identity_lock: boolean;
  identity_prompt: string | null;
  locked_features: string[];
  editable_features: string[];
  reference_image_count: number;
}

interface Props {
  products: ProductOption[];
  models: ModelOption[];
}

const VISUAL_HOOK_TYPES = [
  'Real-life Situation',
  'Problem–Solution',
  'Founder Trust',
  'QR Verification',
  'Review / Social Proof',
  'News Editorial',
  'Dark Marketing',
  'Red Bag',
  'Dark Vault',
  'Product Hero',
  'Lifestyle',
  'Comparison',
  'Educational',
  'Promotion'
];

type Step = 1 | 2 | 3 | 4;
type Destination = 'inside' | 'export';

const FUNNEL_OPTIONS = ['Awareness', 'Consideration', 'Conversion', 'Retention'];
const PLATFORM_OPTIONS = ['TikTok', 'Facebook Ads', 'Instagram', 'Shopee', 'Lazada', 'Website'];
const HOOK_STRENGTH_OPTIONS = ['Safe', 'Strong', 'Unexpected', 'ผสมทั้งหมด'];
const RATIO_OPTIONS = ['1:1', '4:5', '9:16', '16:9'];
const IDEA_QTY_PRESETS = [3, 6, 9];
const PROVIDER_OPTIONS: { value: PromptProvider; label: string; exportOnly: boolean }[] = [
  { value: 'openai', label: 'OpenAI / ChatGPT Image', exportOnly: false },
  { value: 'gemini', label: 'Gemini / Imagen', exportOnly: true },
  { value: 'midjourney', label: 'Midjourney', exportOnly: true },
  { value: 'flux', label: 'Flux', exportOnly: true },
  { value: 'veo', label: 'Google Flow / Veo', exportOnly: true },
  { value: 'universal', label: 'Universal', exportOnly: true }
];

const STRENGTH_COLORS: Record<string, string> = {
  Safe: 'var(--accent-analytics)',
  Strong: 'var(--accent-distribution)',
  Unexpected: 'var(--accent-intelligence)'
};

function ratioToOpenAISize(ratio: string): '1024x1024' | '1024x1536' | '1536x1024' {
  if (ratio === '9:16' || ratio === '4:5') return '1024x1536';
  if (ratio === '16:9') return '1536x1024';
  return '1024x1024';
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VisualHookBannerClient({ products, models }: Props) {
  const [step, setStep] = useState<Step>(1);

  // Creative Brief state — deliberately independent of each other so
  // switching product never resets Model Identity and vice versa (explicit
  // spec requirement — Model and Product are independent entities, no FK
  // between model_presets and products at all).
  const [productId, setProductId] = useState('');
  const [modelPresetId, setModelPresetId] = useState('');
  // Supplementary free-text — still fully usable on its own with no preset
  // selected (backward compatible with the original free-text-only field),
  // and additive on top of a selected preset (e.g. "ยืนยิ้มถือสินค้ามือขวา").
  const [modelIdentity, setModelIdentity] = useState('');
  const [funnelStage, setFunnelStage] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [objective, setObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [painPoint, setPainPoint] = useState('');
  const [benefit, setBenefit] = useState('');
  const [proof, setProof] = useState('');
  const [promotion, setPromotion] = useState('');
  const [contentStyle, setContentStyle] = useState('');
  const [visualHookSeed, setVisualHookSeed] = useState('');
  const [hookStrength, setHookStrength] = useState('ผสมทั้งหมด');
  const [numIdeas, setNumIdeas] = useState(6);
  const [outputRatio, setOutputRatio] = useState('1:1');

  const [ideas, setIdeas] = useState<VisualIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideaError, setIdeaError] = useState('');
  const [variatingId, setVariatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedIdea, setSelectedIdea] = useState<VisualIdea | null>(null);
  const [blocks, setBlocks] = useState<Record<string, PromptStudioBlockState>>({});
  const [provider, setProvider] = useState<PromptProvider>('openai');
  const [presets, setPresets] = useState<PromptStudioPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presetMsg, setPresetMsg] = useState('');

  const [destination, setDestination] = useState<Destination>('inside');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [variationCount, setVariationCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [results, setResults] = useState<
    { signed_urls: string[]; estimated_cost: number; created_at: string; model: string; used_reference_images: number; used_identity_lock: boolean; used_packaging_lock: boolean }[]
  >([]);

  const selectedModel = models.find((m) => m.id === modelPresetId) || null;

  // Composes the preset's locked identity + feature rules with the
  // freeform supplementary text into one description string — kept as a
  // single string because prompts/visual-hook-banner.ts's VisualBriefInput
  // already treats modelIdentity as one free-text block end to end (Idea
  // generation, Prompt Studio seeding); no backend schema change needed.
  function effectiveModelIdentity(): string {
    const parts: string[] = [];
    if (selectedModel) {
      parts.push(`${selectedModel.name}${selectedModel.identity_lock ? ' (Identity Lock: ต้องคงใบหน้าเดิม)' : ''}`);
      if (selectedModel.identity_prompt) parts.push(selectedModel.identity_prompt);
      if (selectedModel.locked_features.length) parts.push(`ห้ามเปลี่ยน: ${selectedModel.locked_features.join(', ')}`);
      if (selectedModel.editable_features.length) parts.push(`เปลี่ยนได้: ${selectedModel.editable_features.join(', ')}`);
    }
    if (modelIdentity.trim()) parts.push(modelIdentity.trim());
    return parts.join('\n');
  }

  function brief() {
    return {
      modelIdentity: effectiveModelIdentity() || undefined,
      funnelStage: funnelStage || undefined,
      platform: platform || undefined,
      objective: objective || undefined,
      targetAudience: targetAudience || undefined,
      painPoint: painPoint || undefined,
      benefit: benefit || undefined,
      proof: proof || undefined,
      promotion: promotion || undefined,
      contentStyle: contentStyle || undefined,
      visualHookSeed: visualHookSeed || undefined,
      hookStrength: hookStrength || undefined,
      outputRatio: outputRatio || undefined
    };
  }

  const selectedProduct = products.find((p) => p.id === productId) || null;

  async function handleGenerateIdeas() {
    setIdeaError('');
    setLoadingIdeas(true);
    try {
      const res = await fetch('/api/creative/visual-ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'generate', product_id: productId || null, quantity: numIdeas, brief: brief() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้าง Visual Ideas ไม่สำเร็จ');
      setIdeas(json.ideas as VisualIdea[]);
      setStep(2);
    } catch (err: any) {
      setIdeaError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoadingIdeas(false);
    }
  }

  async function handleVariation(idea: VisualIdea) {
    setVariatingId(idea.id);
    setIdeaError('');
    try {
      const res = await fetch('/api/creative/visual-ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'variation', base_idea_id: idea.id, brief: brief() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้าง Variation ไม่สำเร็จ');
      setIdeas((prev) => [...(json.ideas as VisualIdea[]), ...prev]);
    } catch (err: any) {
      setIdeaError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setVariatingId(null);
    }
  }

  // Narrowed to the specific editable text fields (not the full keyof
  // VisualIdea) — several VisualIdea fields aren't plain strings (e.g.
  // `brief`), and TypeScript can't verify a generic `[field]: string`
  // assignment against a wide keyof union.
  function updateIdeaField(id: string, field: 'visual_hook' | 'scene' | 'text_hook' | 'cta', value: string) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function sendToPromptStudio(idea: VisualIdea) {
    setSelectedIdea(idea);
    setBlocks(
      seedPromptStudioBlocks(
        {
          title: idea.title,
          creative_angle: idea.creative_angle,
          visual_hook: idea.visual_hook,
          scene: idea.scene,
          situation: idea.situation,
          pain_point: idea.pain_point,
          emotion: idea.emotion,
          solution: idea.solution,
          benefit: idea.benefit,
          proof: idea.proof,
          text_hook: idea.text_hook,
          supporting_text: idea.supporting_text,
          offer: idea.offer,
          cta: idea.cta,
          layout: idea.layout,
          funnel_stage: idea.funnel_stage
        },
        brief(),
        selectedProduct ? { productName: selectedProduct.product_name, brand: selectedProduct.brand } : null
      )
    );
    setStep(3);
  }

  function toggleBlock(key: string) {
    setBlocks((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key]?.enabled } }));
  }
  function editBlock(key: string, text: string) {
    setBlocks((prev) => ({ ...prev, [key]: { ...prev[key], text } }));
  }

  async function loadPresets() {
    try {
      const res = await fetch('/api/creative/prompt-studio-presets?mode=visual_hook_banner');
      const json = await res.json();
      if (res.ok) setPresets(json.presets as PromptStudioPreset[]);
    } catch {
      // silent — non-critical convenience feature
    }
  }

  async function savePreset() {
    if (!presetName.trim()) return;
    setPresetMsg('');
    try {
      const res = await fetch('/api/creative/prompt-studio-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName.trim(), mode: 'visual_hook_banner', blocks })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึก Preset ไม่สำเร็จ');
      setPresetMsg(`✓ บันทึก "${presetName.trim()}" แล้ว`);
      setPresetName('');
      loadPresets();
    } catch (err: any) {
      setPresetMsg(err.message || 'เกิดข้อผิดพลาด');
    }
  }

  function applyPreset(p: PromptStudioPreset) {
    setBlocks(p.blocks);
  }

  const formattedPrompt = formatPromptForProvider(blocks, provider, outputRatio);
  const isExportOnlyProvider = PROVIDER_OPTIONS.find((p) => p.value === provider)?.exportOnly ?? true;

  async function handleGenerateInside() {
    setGenerateError('');
    setGenerating(true);
    try {
      const finalPrompt = buildFinalImagePrompt(formatPromptForProvider(blocks, 'openai', outputRatio));
      const res = await fetch('/api/creative/visual-hook-banner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          size: ratioToOpenAISize(outputRatio),
          quality,
          n: variationCount,
          product_id: productId || null,
          visual_idea_id: selectedIdea?.id || null,
          model_preset_id: modelPresetId || null
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างภาพไม่สำเร็จ');
      setResults((prev) => [
        {
          signed_urls: json.signed_urls,
          estimated_cost: json.estimated_cost,
          created_at: json.created_at,
          model: json.model,
          used_reference_images: json.used_reference_images ?? 0,
          used_identity_lock: !!json.used_identity_lock,
          used_packaging_lock: !!json.used_packaging_lock
        },
        ...prev
      ]);
      setStep(4);
    } catch (err: any) {
      setGenerateError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setGenerating(false);
    }
  }

  function copyPromptFor(p: PromptProvider) {
    navigator.clipboard.writeText(formatPromptForProvider(blocks, p, outputRatio));
  }

  function downloadReferencePackage() {
    // NOTE: this is a .txt summary, not the ZIP-of-actual-images the full
    // spec describes (master-prompt.txt + real packshot/reference PNGs +
    // layout-guide.json etc bundled together) — that needs a zip library
    // this project doesn't have installed yet (deliberately not added this
    // batch, disclosed in TODO.md). Everything text-based the ZIP would
    // have contained is included here; only the actual image binaries are
    // missing (download them individually from Model Library / Products).
    const text = `=== ZANA Visual Hook Banner — Reference Package ===
Generated: ${new Date().toLocaleString('th-TH')}

--- Model ---
${selectedModel ? `${selectedModel.name}${selectedModel.identity_lock ? ' (Identity Lock)' : ''} — ${selectedModel.reference_image_count} รูปอ้างอิงในระบบ` : 'ไม่ระบุ Model Preset'}
${modelIdentity ? `เพิ่มเติม: ${modelIdentity}` : ''}

--- Product ---
${selectedProduct ? `${selectedProduct.brand} — ${selectedProduct.product_name}` : 'ไม่ระบุสินค้าเฉพาะ'}

--- Idea ---
${selectedIdea ? JSON.stringify(selectedIdea, null, 2) : '(none selected)'}

--- Assembled Prompt (provider-neutral) ---
${assembleBlocksText(blocks)}

--- Formatted for ${provider} ---
${formattedPrompt}
`;
    downloadFile(`visual-hook-banner-${Date.now()}.txt`, text, 'text/plain');
  }

  function downloadJSON() {
    const payload = { model: selectedModel, modelIdentityNote: modelIdentity, product: selectedProduct, idea: selectedIdea, blocks, provider, ratio: outputRatio, formattedPrompt };
    downloadFile(`visual-hook-banner-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-sm flex-wrap">
        {(['1. Creative Brief', '2. Visual Ideas', '3. Prompt Studio', '4. Generate / Export'] as const).map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (i + 1 === 3 && !selectedIdea) return;
              if (i + 1 === 4 && !selectedIdea) return;
              setStep((i + 1) as Step);
              if (i + 1 === 3) loadPresets();
            }}
            className={`px-3 py-1.5 rounded-full border ${step === i + 1 ? 'bg-navy text-white border-navy' : 'border-border text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">A. Creative Brief</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Product Preset (ไม่บังคับ)</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— ไม่ระบุสินค้า (ระดับแบรนด์) —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} — {p.product_name}
                  </option>
                ))}
              </select>
              <a href="/products/new" target="_blank" rel="noreferrer" className="text-xs text-accentBlue">
                + เพิ่มสินค้าใหม่ใน Product Library
              </a>
            </div>
            <div>
              <label className="field-label">Model Preset</label>
              <select value={modelPresetId} onChange={(e) => setModelPresetId(e.target.value)}>
                <option value="">— Product Only / อธิบายเอง —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.identity_lock ? '🔒' : ''} ({m.reference_image_count} รูป)
                  </option>
                ))}
              </select>
              <a href="/models/new" target="_blank" rel="noreferrer" className="text-xs text-accentBlue">
                + เพิ่ม Model ใหม่ใน Model Library
              </a>
              {selectedModel && selectedModel.identity_lock && selectedModel.reference_image_count === 0 && (
                <div className="text-xs mt-1 rounded p-2" style={{ background: 'var(--accent-strategy-tint)', color: 'var(--accent-strategy)' }}>
                  ⚠ Model นี้ยังไม่มีรูปอ้างอิงในระบบ — Generate ภายในระบบจะเป็น Text-to-image เท่านั้น ใบหน้าอาจไม่ตรงต้นฉบับ 100%
                  แนะนำอัปโหลดรูปที่ Model Library ก่อน
                </div>
              )}
              <input
                className="mt-2"
                value={modelIdentity}
                onChange={(e) => setModelIdentity(e.target.value)}
                placeholder={selectedModel ? 'รายละเอียดเพิ่มเติม (ไม่บังคับ) เช่น ท่ายืนถือสินค้ามือขวา' : 'หรือพิมพ์อธิบายเอง เช่น หญิงไทยวัย 30 ยิ้มสดใส ผมยาว'}
              />
            </div>
            <div>
              <label className="field-label">Funnel Stage</label>
              <select value={funnelStage} onChange={(e) => setFunnelStage(e.target.value)}>
                <option value="">— ไม่ระบุ —</option>
                {FUNNEL_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Objective</label>
              <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="เช่น เพิ่มยอดขายโปรใหม่" />
            </div>
            <div>
              <label className="field-label">Target Audience</label>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="เช่น คุณแม่มือใหม่ 25-35" />
            </div>
            <div>
              <label className="field-label">Pain Point</label>
              <input value={painPoint} onChange={(e) => setPainPoint(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Benefit</label>
              <input value={benefit} onChange={(e) => setBenefit(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Proof</label>
              <input value={proof} onChange={(e) => setProof(e.target.value)} placeholder="ต้องยืนยันได้จริงเท่านั้น" />
            </div>
            <div>
              <label className="field-label">Promotion</label>
              <input value={promotion} onChange={(e) => setPromotion(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Content Style</label>
              <input value={contentStyle} onChange={(e) => setContentStyle(e.target.value)} placeholder="เช่น Premium clean, Cute pastel" />
            </div>
            <div className="col-span-2">
              <label className="field-label">Visual Hook (ไอเดียเริ่มต้น ไม่บังคับ)</label>
              <input value={visualHookSeed} onChange={(e) => setVisualHookSeed(e.target.value)} placeholder="พิมพ์เอง หรือเลือกจากแนวด้านล่าง" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {VISUAL_HOOK_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setVisualHookSeed((prev) => (prev.includes(t) ? prev : prev ? `${prev}, ${t}` : t))}
                    className="text-xs px-2 py-1 rounded-full border border-border text-gray-500 hover:border-accentBlue hover:text-accentBlue"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Hook Strength</label>
              <select value={hookStrength} onChange={(e) => setHookStrength(e.target.value)}>
                {HOOK_STRENGTH_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Output Ratio</label>
              <select value={outputRatio} onChange={(e) => setOutputRatio(e.target.value)}>
                {RATIO_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">จำนวน Idea</label>
              <div className="flex gap-2 items-center flex-wrap">
                {IDEA_QTY_PRESETS.map((q) => (
                  <button key={q} type="button" onClick={() => setNumIdeas(q)} className={numIdeas === q ? 'btn-primary' : 'btn-secondary'}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {ideaError && <div className="text-red-600 text-sm">{ideaError}</div>}
          <button className="btn-primary" disabled={loadingIdeas} onClick={handleGenerateIdeas}>
            {loadingIdeas ? 'กำลังสร้าง Visual Ideas...' : `สร้าง ${numIdeas} Visual Ideas`}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">B. AI Visual Ideas ({ideas.length})</h2>
            <button className="btn-secondary" onClick={() => setStep(1)}>
              ← กลับไป Brief
            </button>
          </div>
          {ideaError && <div className="text-red-600 text-sm">{ideaError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ideas.map((idea) => {
              const isEditing = editingId === idea.id;
              return (
                <div key={idea.id} className="card p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold flex-1">{idea.title}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                      style={{ background: STRENGTH_COLORS[idea.expected_strength || 'Safe'] }}
                    >
                      {idea.expected_strength}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border">{idea.funnel_stage}</span>
                  </div>

                  {!isEditing ? (
                    <div className="text-sm space-y-1 text-gray-600">
                      <div>
                        <b>Hook:</b> {idea.visual_hook}
                      </div>
                      <div>
                        <b>Scene:</b> {idea.scene}
                      </div>
                      <div>
                        <b>Text Hook:</b> {idea.text_hook}
                      </div>
                      <div>
                        <b>CTA:</b> {idea.cta}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm space-y-2">
                      <textarea rows={2} value={idea.visual_hook ?? ''} onChange={(e) => updateIdeaField(idea.id, 'visual_hook', e.target.value)} placeholder="Visual Hook" />
                      <textarea rows={2} value={idea.scene ?? ''} onChange={(e) => updateIdeaField(idea.id, 'scene', e.target.value)} placeholder="Scene" />
                      <input value={idea.text_hook ?? ''} onChange={(e) => updateIdeaField(idea.id, 'text_hook', e.target.value)} placeholder="Text Hook" />
                      <input value={idea.cta ?? ''} onChange={(e) => updateIdeaField(idea.id, 'cta', e.target.value)} placeholder="CTA" />
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap pt-1">
                    <button className="btn-primary !px-2 !py-1 !text-xs" onClick={() => sendToPromptStudio(idea)}>
                      เลือกไอเดียนี้ → Prompt Studio
                    </button>
                    <button className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => setEditingId(isEditing ? null : idea.id)}>
                      {isEditing ? '✓ เสร็จแก้ไข' : '✎ แก้ไข'}
                    </button>
                    <button className="btn-secondary !px-2 !py-1 !text-xs" disabled={variatingId === idea.id} onClick={() => handleVariation(idea)}>
                      {variatingId === idea.id ? 'กำลังสร้าง...' : '⟳ สร้าง Variation'}
                    </button>
                  </div>
                  <div className="text-xs text-gray-400">บันทึกลงระบบแล้วอัตโนมัติ — ดูย้อนหลังได้ที่ Content Library</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && selectedIdea && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">C. Prompt Studio — {selectedIdea.title}</h2>
            <button className="btn-secondary" onClick={() => setStep(2)}>
              ← กลับไป Visual Ideas
            </button>
          </div>

          {presets.length > 0 && (
            <div>
              <label className="field-label">โหลด Preset ที่บันทึกไว้</label>
              <div className="flex gap-2 flex-wrap">
                {presets.map((p) => (
                  <button key={p.id} type="button" className="btn-secondary !text-xs" onClick={() => applyPreset(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {PROMPT_STUDIO_BLOCK_DEFS.map((b) => (
              <div key={b.key} className="border border-border rounded-lg p-3">
                <label className="flex items-center gap-2 mb-1.5">
                  <input type="checkbox" checked={blocks[b.key]?.enabled ?? false} onChange={() => toggleBlock(b.key)} />
                  <span className="font-semibold text-sm">{b.label}</span>
                </label>
                <textarea
                  rows={2}
                  value={blocks[b.key]?.text ?? ''}
                  onChange={(e) => editBlock(b.key, e.target.value)}
                  disabled={!blocks[b.key]?.enabled}
                  className="text-sm"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 items-center flex-wrap pt-2 border-t border-border">
            <input className="!w-64" placeholder="ตั้งชื่อ Preset..." value={presetName} onChange={(e) => setPresetName(e.target.value)} />
            <button type="button" className="btn-secondary !text-xs" onClick={savePreset}>
              💾 บันทึกเป็น Preset
            </button>
            {presetMsg && <span className="text-xs text-gray-500">{presetMsg}</span>}
          </div>

          <div>
            <label className="field-label">Prompt Compatibility</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as PromptProvider)}>
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} {p.exportOnly ? '(Export only)' : '(Generate ได้จริง)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Assembled Prompt ({PROVIDER_OPTIONS.find((p) => p.value === provider)?.label})</label>
            <textarea rows={6} readOnly value={formattedPrompt} className="text-xs bg-surface" />
          </div>

          <button className="btn-primary" onClick={() => setStep(4)}>
            ไปเลือก Generation Destination →
          </button>
        </div>
      )}

      {step === 4 && selectedIdea && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">D. Generation Destination</h2>
            <button className="btn-secondary" onClick={() => setStep(3)}>
              ← กลับไป Prompt Studio
            </button>
          </div>

          <div className="flex gap-2">
            <button type="button" className={destination === 'inside' ? 'btn-primary' : 'btn-secondary'} onClick={() => setDestination('inside')}>
              1. Generate Inside ZANA OS
            </button>
            <button type="button" className={destination === 'export' ? 'btn-primary' : 'btn-secondary'} onClick={() => setDestination('export')}>
              2. Export to External AI
            </button>
          </div>

          {destination === 'inside' && (
            <div className="card p-6 space-y-4">
              {isExportOnlyProvider && (
                <div className="text-sm rounded-lg p-3" style={{ background: 'var(--accent-strategy-tint)', color: 'var(--accent-strategy)' }}>
                  ⚠ {PROVIDER_OPTIONS.find((p) => p.value === provider)?.label} ยังไม่ได้เชื่อมต่อ API จริงในระบบนี้ (Phase 2) — ระบบจะใช้ <b>OpenAI</b> สร้างภาพให้แทน
                  หรือกด &ldquo;Export to External AI&rdquo; เพื่อคัดลอก Prompt ไปใช้กับ {PROVIDER_OPTIONS.find((p) => p.value === provider)?.label} เองได้เลย
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Provider</label>
                  <input value="OpenAI (gpt-image-1)" disabled />
                </div>
                <div>
                  <label className="field-label">Ratio</label>
                  <input value={`${outputRatio} → ${ratioToOpenAISize(outputRatio)}`} disabled />
                </div>
                <div>
                  <label className="field-label">Quality</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value as 'low' | 'medium' | 'high')}>
                    <option value="low">Low (เร็ว/ถูก)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (แนะนำ)</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">จำนวน Variations</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" className={variationCount === n ? 'btn-primary' : 'btn-secondary'} onClick={() => setVariationCount(n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Estimated Cost: ~${((quality === 'low' ? 0.011 : quality === 'medium' ? 0.042 : 0.167) * variationCount).toFixed(3)} USD (ประมาณการ ไม่ใช่ยอดเรียกเก็บจริง)
              </div>
              <div className="text-xs text-gray-400">
                {selectedModel && selectedModel.reference_image_count > 0 && '🔒 ใช้รูปอ้างอิงจริงจาก Model Library เพื่อคง Identity — '}
                {selectedProduct && '📦 ใช้ Packshot จริงจาก Product Library (ถ้ามี และเปิด Preserve Packaging) — '}
                {!selectedModel?.reference_image_count && !selectedProduct && 'ไม่มีรูปอ้างอิง — จะเป็น Text-to-image ล้วน'}
              </div>
              {generateError && <div className="text-red-600 text-sm">{generateError}</div>}
              <button className="btn-primary" disabled={generating} onClick={handleGenerateInside}>
                {generating ? 'กำลังสร้างภาพ...' : `Generate ${variationCount} ภาพ`}
              </button>
            </div>
          )}

          {destination === 'export' && (
            <div className="card p-6 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <button className="btn-secondary" onClick={() => copyPromptFor('openai')}>
                  📋 Copy Prompt for GPT
                </button>
                <button className="btn-secondary" onClick={() => copyPromptFor('gemini')}>
                  📋 Copy Prompt for Gemini
                </button>
                <button className="btn-secondary" onClick={() => copyPromptFor('midjourney')}>
                  📋 Copy Prompt for Midjourney
                </button>
                <button className="btn-secondary" onClick={() => copyPromptFor('universal')}>
                  📋 Copy Universal Prompt
                </button>
                <button className="btn-secondary" onClick={downloadReferencePackage}>
                  ⬇ Download Reference Package
                </button>
                <button className="btn-secondary" onClick={downloadJSON}>
                  ⬇ Export JSON
                </button>
              </div>
              <div className="text-xs text-gray-400">Reference Package เป็นไฟล์ .txt สรุป Prompt + ข้อมูลสินค้า + Idea ทั้งหมด (ยังไม่รวมรูปภาพ)</div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">F. Generated Results</h3>
              {results.map((r, i) => (
                <div key={i} className="card p-4">
                  <div className="text-xs text-gray-400 mb-2">
                    {r.model} · ~${r.estimated_cost.toFixed(3)} · {new Date(r.created_at).toLocaleString('th-TH')}
                    {r.used_reference_images > 0 && (
                      <span className="ml-2 text-accentGreen">
                        · ใช้รูปอ้างอิงจริง {r.used_reference_images} ภาพ{r.used_identity_lock ? ' (Identity)' : ''}
                        {r.used_packaging_lock ? ' (Packaging)' : ''}
                      </span>
                    )}
                    {r.used_reference_images === 0 && <span className="ml-2 text-orange-500">· Text-to-image ล้วน ไม่มีรูปอ้างอิง</span>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {r.signed_urls.map((url, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={j} href={url} target="_blank" rel="noreferrer" className="block">
                        <img src={url} alt={`Visual Hook Banner ${j + 1}`} className="rounded-lg border border-border w-full" />
                        <div className="text-xs text-center mt-1 text-accentBlue">Download</div>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
