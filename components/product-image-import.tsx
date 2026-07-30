'use client';

import { useState } from 'react';
import type { Product } from '@/types/database';
import { ProductForm } from './product-form';

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64] = result.split(',');
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProductImageImport({
  action,
  error,
  submitLabel
}: {
  action: (formData: FormData) => void;
  error?: string;
  submitLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [prefill, setPrefill] = useState<Partial<Product> | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setAiError('รองรับเฉพาะไฟล์ PNG, JPEG, WEBP');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAiError('ไฟล์ใหญ่เกินไป (จำกัด 8MB)');
      return;
    }

    setLoading(true);
    setAiError(null);
    setNotes(null);

    try {
      const { base64, mimeType } = await fileToBase64(file);
      const res = await fetch('/api/products/extract-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType })
      });
      const json = await res.json();

      if (!res.ok) {
        setAiError(json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
        setLoading(false);
        return;
      }

      const ext = json.extracted;
      setPrefill({
        brand: ext.brand ?? undefined,
        product_name: ext.product_name ?? undefined,
        sku: ext.sku ?? undefined,
        category: ext.category ?? undefined,
        selling_price: ext.selling_price ?? undefined,
        promotion_price: ext.promotion_price ?? undefined,
        usp: ext.usp ?? undefined,
        ingredients: ext.ingredients ?? undefined,
        benefits: ext.benefits ?? undefined,
        usage: ext.usage ?? undefined,
        allowed_claims: ext.allowed_claims ?? undefined,
        banned_claims: ext.banned_claims ?? undefined
      });
      setConfidence(ext.confidence);
      setNotes(ext.notes_for_human_review);
      setFormKey((k) => k + 1);
    } catch (err: any) {
      setAiError(err?.message || 'เรียก AI ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-semibold mb-2">นำเข้าจากรูปภาพ (AI ช่วยกรอก)</h2>
        <p className="text-sm text-gray-400 mb-3">
          อัปโหลดรูปฉลาก/กล่องสินค้า — AI จะกรอกฟอร์มด้านล่างให้อัตโนมัติ{' '}
          <span className="text-accentRed">คุณต้องตรวจสอบความถูกต้องก่อนกดบันทึกเสมอ</span> (AI ไม่บันทึกให้เองโดยตรง)
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          disabled={loading}
          className="text-sm"
        />
        {loading && <p className="text-sm text-accentTeal mt-2">กำลังวิเคราะห์รูปภาพ...</p>}
        {aiError && (
          <div className="mt-3 rounded-lg border border-accentRed/50 bg-accentRed/10 px-3 py-2 text-sm text-accentRed">
            {aiError}
          </div>
        )}
        {confidence != null && (
          <div className="mt-3 text-sm text-gray-400">
            ความมั่นใจของ AI: <span className="text-accentTeal">{confidence}/100</span>
            {notes && <div className="mt-1 text-gray-500">หมายเหตุ: {notes}</div>}
          </div>
        )}
      </div>

      <ProductForm key={formKey} product={prefill ?? undefined} action={action} error={error} submitLabel={submitLabel} />
    </div>
  );
}
