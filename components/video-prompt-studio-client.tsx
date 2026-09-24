'use client';

import { useMemo, useState } from 'react';
import type { ModelPreset, Product, VideoPromptPreset } from '@/types/database';
import { checkScriptPace, isSkincareCategory, type VideoPromptVariables } from '@/prompts/video-prompt-studio';

// AI Video Prompt Studio — P0 wizard (spec doc "ZANA AI Video Prompt Studio
// — Spec & Build Plan", UI Flow section). 9 steps as a single-page wizard
// with tabs, not separate routes — same pattern as
// components/visual-hook-banner-client.tsx's 4-step flow. Custom Director
// (manual per-scene control, step 6's alternate mode) is P1 — this ships
// Auto Director only, disclosed in the UI rather than silently omitted.

const CREATIVE_MODES = [
  'UGC Hands Only',
  'UGC Male Review',
  'UGC Female Review',
  'Social x TV Hybrid',
  'Premium TV Commercial',
  'Product Demonstration',
  'Sensory / Texture',
  'Direct Response Conversion'
];

const CHARACTER_MODES = ['No Face', 'Hands Only', 'POV', 'Body Crop', 'Product Only', 'Human', 'Male', 'Female', 'Founder', 'Creator / Customer'];
const AGE_BANDS = ['20-25', '25-35', '35-45', '45+'];
const PERSONAS = ['Real customer', 'Creator', 'Expert', 'Premium model', 'Working person', 'Mom', 'Dad'];
const FUNNEL_STAGES = ['Awareness', 'Consideration', 'Conversion', 'Retention'];
const DURATIONS = [5, 8, 10, 15, 20, 30];
const SCENE_COUNTS = [3, 4, 5, 6, 7];
const PACING_OPTIONS = ['Fast Viral', 'High Retention', 'Balanced', 'Premium', 'Cinematic'];
const VISUAL_QUALITY_OPTIONS = ['Real UGC', 'Commercial UGC', 'Social x TV', 'Beauty TVC', 'Luxury Editorial'];
const TEXT_MODES = ['None', 'Minimal TVC', 'TikTok Hook', 'Native UGC', 'Conversion'];
const TEXT_FREQUENCIES = ['Hook only', 'Every 3 sec', 'Every Scene', 'Auto'];
const VOICE_OPTIONS = ['No Voice', 'Thai Male', 'Thai Female', 'Custom'];
const VOICE_STYLES = ['Casual', 'Creator', 'Energetic', 'Confident', 'Premium', 'Soft Luxury', 'Educational'];

const STEPS = [
  { id: 1, label: 'สินค้า' },
  { id: 2, label: 'Creative Mode' },
  { id: 3, label: 'Character' },
  { id: 4, label: 'Funnel' },
  { id: 5, label: 'Visual Style' },
  { id: 6, label: 'Scene Engine' },
  { id: 7, label: 'Voice/Text' },
  { id: 8, label: 'Generate' }
];

function FieldSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— ไม่ระบุ —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function VideoPromptStudioClient({
  products,
  modelPresets,
  presets
}: {
  products: Pick<Product, 'id' | 'product_name' | 'brand' | 'category'>[];
  modelPresets: Pick<ModelPreset, 'id' | 'name' | 'type' | 'identity_lock' | 'reference_images' | 'master_reference'>[];
  presets: VideoPromptPreset[];
}) {
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState('');
  const [modelPresetId, setModelPresetId] = useState('');
  const [vars, setVars] = useState<VideoPromptVariables>({ duration_sec: 10, scene_count: 6 });
  const [compiledPrompt, setCompiledPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);
  const selectedModel = useMemo(() => modelPresets.find((m) => m.id === modelPresetId) ?? null, [modelPresets, modelPresetId]);
  const skincareMode = isSkincareCategory(selectedProduct?.category ?? null);
  const pace = checkScriptPace(vars.script_length_words, vars.duration_sec);

  function set<K extends keyof VideoPromptVariables>(key: K, value: VideoPromptVariables[K]) {
    setVars((prev) => ({ ...prev, [key]: value }));
  }

  function applyPreset(preset: VideoPromptPreset) {
    setVars((prev) => ({ ...prev, ...preset.variables }));
    setStep(8);
  }

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setCompiledPrompt('');
    try {
      const res = await fetch('/api/video-prompt-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compile', product_id: productId || null, model_preset_id: modelPresetId || null, variables: vars })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้าง Prompt ไม่สำเร็จ');
      setCompiledPrompt(json.compiled_prompt);
    } catch (e: any) {
      setError(e?.message || 'สร้าง Prompt ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!compiledPrompt) return;
    setSaving(true);
    setSavedMessage('');
    setError('');
    try {
      const res = await fetch('/api/video-prompt-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', product_id: productId || null, model_preset_id: modelPresetId || null, variables: vars, compiled_prompt: compiledPrompt })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
      setSavedMessage('บันทึกโปรเจกต์แล้ว');
    } catch (e: any) {
      setError(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(compiledPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy ไม่สำเร็จ — เลือกข้อความแล้ว copy เองได้');
    }
  }

  return (
    <div className="space-y-6">
      {presets.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <label className="field-label">1-Click Preset</label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className={preset.is_system_default ? 'btn-primary' : 'btn-secondary'}>
                {preset.is_system_default ? '⭐ ' : ''}
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`px-3 py-1.5 rounded-full text-sm ${step === s.id ? 'bg-accentBlue text-white' : 'bg-surface text-gray-500'}`}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {step === 1 && (
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="field-label">Product Reference</label>
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
            <label className="field-label">Model / Founder (ไม่บังคับ)</label>
            <select value={modelPresetId} onChange={(e) => setModelPresetId(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {modelPresets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {selectedModel?.identity_lock && !selectedModel.reference_images?.length && !selectedModel.master_reference && (
              <p className="text-xs text-amber-600 mt-1">⚠ Preset นี้ยังไม่มีรูปอ้างอิงจริงใน Model Library — Identity Lock จะพึ่งคำบรรยายข้อความอย่างเดียว</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input id="strict_lock" type="checkbox" checked disabled />
            <label htmlFor="strict_lock" className="mb-0">
              STRICT Product Lock — บังคับใช้เสมอ (ห้าม AI วาดแพ็กเกจ/โลโก้/สีใหม่ — ไม่มีปุ่มปิด ตามสเปก)
            </label>
          </div>
          {skincareMode && (
            <p className="text-xs text-accentBlue">
              ตรวจพบว่าสินค้านี้เป็นกลุ่มสกินแคร์ — Skincare Beauty Engine จะถูกใช้อัตโนมัติตอนสร้าง Prompt (ตัวเลือกละเอียดสำหรับ Skin Finish/Texture/Ingredient Visual จะเปิดใน Phase 2)
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="max-w-2xl">
          <FieldSelect label="Creative Mode" value={vars.creative_mode ?? ''} options={CREATIVE_MODES} onChange={(v) => set('creative_mode', v)} />
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
          <FieldSelect label="Character Mode" value={vars.character_mode ?? ''} options={CHARACTER_MODES} onChange={(v) => set('character_mode', v)} />
          <FieldSelect label="Age Appearance" value={vars.age_appearance ?? ''} options={AGE_BANDS} onChange={(v) => set('age_appearance', v)} />
          <FieldSelect label="Persona" value={vars.character_persona ?? ''} options={PERSONAS} onChange={(v) => set('character_persona', v)} />
        </div>
      )}

      {step === 4 && (
        <div className="max-w-2xl">
          <FieldSelect label="Funnel Stage" value={vars.funnel_stage ?? ''} options={FUNNEL_STAGES} onChange={(v) => set('funnel_stage', v)} />
        </div>
      )}

      {step === 5 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          <div>
            <label className="field-label">Duration (วินาที)</label>
            <select value={vars.duration_sec ?? 10} onChange={(e) => set('duration_sec', Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} sec
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Scenes</label>
            <select value={vars.scene_count ?? 6} onChange={(e) => set('scene_count', Number(e.target.value))}>
              {SCENE_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <FieldSelect label="Pacing" value={vars.pacing ?? ''} options={PACING_OPTIONS} onChange={(v) => set('pacing', v)} />
          <FieldSelect label="Visual Quality" value={vars.visual_quality ?? ''} options={VISUAL_QUALITY_OPTIONS} onChange={(v) => set('visual_quality', v)} />
        </div>
      )}

      {step === 6 && (
        <div className="max-w-2xl space-y-2">
          <p className="text-sm text-gray-500">
            AUTO DIRECTOR — AI จะคิดฉาก กล้อง แสง Props Transition SFX ให้อัตโนมัติจากตัวเลือกที่เลือกไว้ (Creative Mode/Character/Funnel/Visual Style)
            ตาม Scene count และ Duration ที่กำหนด
          </p>
          <p className="text-xs text-gray-400">CUSTOM DIRECTOR (กำหนด Scene 1–N เอง) จะเปิดใน Phase 1 ของโมดูลนี้ — ยังไม่พร้อมใช้งานตอนนี้</p>
        </div>
      )}

      {step === 7 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          <FieldSelect label="Voice" value={vars.voice_gender ?? ''} options={VOICE_OPTIONS} onChange={(v) => set('voice_gender', v)} />
          <FieldSelect label="Voice Style" value={vars.voice_style ?? ''} options={VOICE_STYLES} onChange={(v) => set('voice_style', v)} />
          <div>
            <label className="field-label">Script Length (คำ)</label>
            <input
              type="number"
              min={0}
              max={200}
              value={vars.script_length_words ?? ''}
              onChange={(e) => set('script_length_words', e.target.value ? Number(e.target.value) : null)}
            />
            {pace.isFastDelivery && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ {pace.wordsPerSec.toFixed(1)} คำ/วินาที — เร็วกว่าจังหวะพูดธรรมชาติ ({vars.duration_sec ?? 10} วินาที) ลองลดจำนวนคำหรือเพิ่มความยาววิดีโอ
              </p>
            )}
          </div>
          <FieldSelect label="Text Mode" value={vars.text_mode ?? ''} options={TEXT_MODES} onChange={(v) => set('text_mode', v)} />
          <FieldSelect label="Text Frequency" value={vars.text_frequency ?? ''} options={TEXT_FREQUENCIES} onChange={(v) => set('text_frequency', v)} />
        </div>
      )}

      {step === 8 && (
        <div className="space-y-4 max-w-3xl">
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? 'กำลังสร้าง...' : 'Generate Master Prompt'}
          </button>

          {compiledPrompt && (
            <div className="space-y-3">
              <textarea readOnly rows={20} value={compiledPrompt} className="w-full font-mono text-xs" />
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-secondary" onClick={handleCopy}>
                  {copied ? '✓ Copy แล้ว' : 'Copy Prompt'}
                </button>
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกโปรเจกต์'}
                </button>
              </div>
              {savedMessage && <p className="text-sm text-green-700">{savedMessage}</p>}
              <p className="text-xs text-gray-500">
                Copy ข้อความนี้ไปวางใน Google Flow / Veo / Runway ฯลฯ — อย่าลืมแนบรูป Packshot จริงของสินค้าประกอบด้วย เพราะ Prompt ข้อความอย่างเดียวพารูปภาพไปด้วยไม่ได้
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4 border-t border-border">
        <button type="button" className="btn-secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
          ← ย้อนกลับ
        </button>
        <button type="button" className="btn-secondary" onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))} disabled={step === STEPS.length}>
          ถัดไป →
        </button>
      </div>
    </div>
  );
}
