'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ModelPreset, ModelPresetType } from '@/types/database';
import { LibraryImagePicker, type LibraryImage } from '@/components/library-image-picker';

// Model Library form — explicit spec Section 3. A client component (not the
// old FormData-server-action pattern used by ProductForm/PersonaForm)
// because it needs live upload previews and multi-select feature toggles;
// talks to the new /api/models JSON routes instead, same architecture as
// the rest of the new Visual Hook Banner subsystem.

const LOCK_OPTIONS = ['ใบหน้า', 'รูปหน้า', 'ดวงตา', 'จมูก', 'ริมฝีปาก', 'สีผิว', 'อายุที่ปรากฏ', 'เอกลักษณ์เฉพาะบุคคล'];
const EDIT_OPTIONS = ['เสื้อผ้า', 'ทรงผมโดยไม่เปลี่ยนใบหน้า', 'ท่าทาง', 'อารมณ์', 'ฉาก', 'แสง', 'มุมกล้อง', 'สินค้าที่ถือ'];

const DEFAULT_FOUNDER_IDENTITY_PROMPT =
  'Use the attached photograph of the real ZANA female founder as the absolute identity reference. Preserve her real facial identity, face shape, eyes, nose, lips, skin tone, age appearance and distinctive features. Do not replace her with a generic AI model. Do not beautify her until she becomes a different person.';

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function ModelForm({ model, initialImages = [] }: { model?: ModelPreset; initialImages?: LibraryImage[] }) {
  const router = useRouter();
  const isEdit = !!model;

  const [name, setName] = useState(model?.name ?? '');
  const [type, setType] = useState<ModelPresetType>(model?.type ?? 'custom');
  const [referenceImages, setReferenceImages] = useState<string[]>(model?.reference_images ?? []);
  const [lockedFeatures, setLockedFeatures] = useState<string[]>(model?.locked_features ?? []);
  const [editableFeatures, setEditableFeatures] = useState<string[]>(model?.editable_features ?? []);
  const [identityLock, setIdentityLock] = useState(model?.identity_lock ?? true);
  const [identityPrompt, setIdentityPrompt] = useState(model?.identity_prompt ?? '');
  const [negativePrompt, setNegativePrompt] = useState(model?.negative_prompt ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) {
      setError('กรุณาระบุชื่อ Model');
      return;
    }
    setError(null);
    const payload = {
      name: name.trim(),
      type,
      reference_images: referenceImages,
      locked_features: lockedFeatures,
      editable_features: editableFeatures,
      identity_lock: identityLock,
      identity_prompt: identityPrompt || null,
      negative_prompt: negativePrompt || null
    };
    startTransition(async () => {
      try {
        const res = await fetch(isEdit ? `/api/models/${model!.id}` : '/api/models', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
        router.push('/models');
        router.refresh();
      } catch (e: any) {
        setError(e?.message || 'บันทึกไม่สำเร็จ');
      }
    });
  }

  function archiveToggle() {
    if (!model) return;
    startTransition(async () => {
      const res = await fetch(`/api/models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !model.active })
      });
      if (res.ok) {
        router.push('/models');
        router.refresh();
      }
    });
  }

  function duplicate() {
    if (!model) return;
    startTransition(async () => {
      const res = await fetch(`/api/models/${model.id}/duplicate`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.model?.id) {
        router.push(`/models/${json.model.id}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="name">ชื่อ Model *</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น คุณชิดชนก — ZANA Founder" />
        </div>
        <div>
          <label className="field-label" htmlFor="type">ประเภท</label>
          <select id="type" value={type} onChange={(e) => setType(e.target.value as ModelPresetType)}>
            <option value="founder">Founder (บุคคลจริง — ล็อกใบหน้า)</option>
            <option value="ai_model">ZANA Premium AI Model</option>
            <option value="custom">อื่นๆ / อัปโหลดใหม่</option>
          </select>
        </div>
      </div>

      <LibraryImagePicker
        name="reference_images"
        label="Reference Photos (1-5 ภาพ) — ใช้เป็น Source of Truth ของใบหน้า"
        folder="models"
        maxFiles={5}
        initial={initialImages}
        onChange={setReferenceImages}
      />

      <div className="flex items-center gap-2">
        <input id="identity_lock" type="checkbox" checked={identityLock} onChange={(e) => setIdentityLock(e.target.checked)} />
        <label htmlFor="identity_lock" className="mb-0">Identity Lock (ล็อกใบหน้าเดิมทุกครั้งที่ Generate)</label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">คุณสมบัติที่ต้องล็อก (ห้ามเปลี่ยน)</label>
          <div className="flex flex-wrap gap-2">
            {LOCK_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setLockedFeatures((prev) => toggleInArray(prev, opt))}
                className={`text-xs px-2 py-1 rounded-full border ${lockedFeatures.includes(opt) ? 'bg-accentBlue text-white border-accentBlue' : 'border-border text-gray-500'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label">คุณสมบัติที่เปลี่ยนได้</label>
          <div className="flex flex-wrap gap-2">
            {EDIT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setEditableFeatures((prev) => toggleInArray(prev, opt))}
                className={`text-xs px-2 py-1 rounded-full border ${editableFeatures.includes(opt) ? 'bg-accentGreen text-white border-accentGreen' : 'border-border text-gray-500'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="field-label" htmlFor="identity_prompt">Identity Prompt</label>
          {type === 'founder' && (
            <button type="button" className="text-xs text-accentBlue" onClick={() => setIdentityPrompt(DEFAULT_FOUNDER_IDENTITY_PROMPT)}>
              ใช้ข้อความแนะนำ
            </button>
          )}
        </div>
        <textarea id="identity_prompt" rows={3} value={identityPrompt} onChange={(e) => setIdentityPrompt(e.target.value)} />
      </div>

      <div>
        <label className="field-label" htmlFor="negative_prompt">Negative Prompt</label>
        <textarea id="negative_prompt" rows={2} value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={submit}>
          {pending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึก Model Preset'}
        </button>
        <a href="/models" className="btn-secondary">ยกเลิก</a>
        {isEdit && (
          <>
            <button type="button" className="btn-secondary" disabled={pending} onClick={duplicate}>
              ทำสำเนา (Duplicate)
            </button>
            <button type="button" className="btn-secondary text-orange-600 border-orange-300" disabled={pending} onClick={archiveToggle}>
              {model!.active ? 'เก็บเข้าคลัง (Archive)' : 'กู้คืน (Restore)'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
