'use client';

import { useRef, useState } from 'react';
import { BANNER_TEMPLATES, type BannerTemplate } from '@/prompts/banner-generator';

// Banner/Ads Image Generator — explicit user request: "เพิ่ม Mode
// Gennerator ภาพ Banner Ai หรือภาพ Ads สำเร็จ เป็นงานที่ให้ค่าย OpenAi ทำ...
// กำหนดได้ว่าจะทำกี่ภาพ ไม่เกินครั้งละ 10ภาพ". Batch mode only for this
// round (per explicit user choice) — pick a template, attach product
// photo(s), choose how many (1–10), generate.
//
// Honesty note baked into the UI copy below (matches this app's "no fake
// features" standard): requesting N images from ONE template call gives N
// STYLE VARIATIONS of the same creative direction to pick the best from —
// not N different creative concepts. Getting genuinely different concepts
// per image is a separate "propose ideas first" flow (the team's own doc
// has this too, item 7/24) — deliberately deferred, not built here, so we
// don't imply a capability this mode doesn't have.

const MAX_REF_IMAGES = 3;
const MAX_FILE_BYTES = 3 * 1024 * 1024; // per-file cap, keeps total request well under Vercel's 4.5MB body limit

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface HistoryItem {
  id: string;
  product_name: string;
  template: string;
  image_count: number;
  created_at: string;
}

interface Props {
  history: HistoryItem[];
}

const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(BANNER_TEMPLATES.map((t) => [t.value, t.label]));

export default function BannerGeneratorClient({ history: initialHistory }: Props) {
  const [productName, setProductName] = useState('');
  const [template, setTemplate] = useState<BannerTemplate>('product_ad');
  const [priceOrPromo, setPriceOrPromo] = useState('');
  const [theme, setTheme] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [count, setCount] = useState(4);
  const [size, setSize] = useState<'1024x1024' | '1024x1536' | '1536x1024'>('1024x1024');
  const [refImages, setRefImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [reviewShot, setReviewShot] = useState<{ name: string; dataUrl: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [historyImages, setHistoryImages] = useState<Record<string, string[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement | null>(null);
  const reviewInputRef = useRef<HTMLInputElement | null>(null);

  const activeTemplate = BANNER_TEMPLATES.find((t) => t.value === template);

  async function handleRefFiles(files: FileList | null) {
    if (!files) return;
    setError('');
    const next = [...refImages];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_REF_IMAGES) break;
      if (file.size > MAX_FILE_BYTES) {
        setError(`ไฟล์ ${file.name} ใหญ่เกินไป (สูงสุด ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB ต่อภาพ)`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        next.push({ name: file.name, dataUrl });
      } catch {
        setError(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`);
      }
    }
    setRefImages(next.slice(0, MAX_REF_IMAGES));
    if (refInputRef.current) refInputRef.current.value = '';
  }

  async function handleReviewFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_FILE_BYTES) {
      setError(`ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB)`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setReviewShot({ name: file.name, dataUrl });
    } catch {
      setError('อ่านไฟล์ Screenshot ไม่สำเร็จ');
    }
    if (reviewInputRef.current) reviewInputRef.current.value = '';
  }

  function removeRefImage(idx: number) {
    setRefImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function generate() {
    if (!productName.trim()) {
      setError('กรุณาใส่ชื่อสินค้า');
      return;
    }
    if (template === 'social_proof' && !reviewShot) {
      setError('เทมเพลต Social Proof ต้องแนบ Screenshot รีวิวจริงก่อน');
      return;
    }
    if (template === 'theme' && !theme.trim()) {
      setError('กรุณาระบุธีม/เทศกาล');
      return;
    }
    setError('');
    setGenerating(true);
    setResults([]);
    try {
      const res = await fetch('/api/tools/banner-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName.trim(),
          template,
          price_or_promo: priceOrPromo.trim() || undefined,
          theme: template === 'theme' ? theme.trim() : undefined,
          extra_notes: extraNotes.trim() || undefined,
          count,
          size,
          reference_images: refImages.map((r) => r.dataUrl),
          review_screenshot: reviewShot?.dataUrl
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างภาพไม่สำเร็จ');

      setResults(json.signed_urls || []);
      if (json.job_id) {
        setHistory((prev) => [
          { id: json.job_id, product_name: productName.trim(), template, image_count: (json.signed_urls || []).length, created_at: json.created_at || new Date().toISOString() },
          ...prev
        ]);
      }
    } catch (err: any) {
      setError(err?.message || 'สร้างภาพไม่สำเร็จ');
    } finally {
      setGenerating(false);
    }
  }

  async function loadHistoryImages(id: string) {
    if (historyImages[id]) return;
    setHistoryLoading(id);
    setError('');
    try {
      const res = await fetch(`/api/tools/banner-generator/generate?resign=${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'โหลดภาพไม่สำเร็จ');
      setHistoryImages((prev) => ({ ...prev, [id]: json.signed_urls || [] }));
    } catch (err: any) {
      setError(err?.message || 'โหลดภาพไม่สำเร็จ');
    } finally {
      setHistoryLoading(null);
    }
  }

  function downloadImage(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <div>
          <label className="field-label">ชื่อสินค้า *</label>
          <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="เช่น KYRA Alpha 3+ Purple" />
        </div>

        <div>
          <label className="field-label">เลือกแนวภาพ</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {BANNER_TEMPLATES.map((t) => (
              <div
                key={t.value}
                className={`card p-3 cursor-pointer ${template === t.value ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setTemplate(t.value)}
              >
                <p className="text-sm font-medium">{t.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">ภาพสินค้าจริง (แนะนำให้แนบ — ระบบจะรักษาแพ็กเกจ/ฉลากเดิม ไม่ออกแบบใหม่)</label>
          <input ref={refInputRef} type="file" accept="image/*" multiple onChange={(e) => handleRefFiles(e.target.files)} />
          {refImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {refImages.map((r, i) => (
                <div key={i} className="flex items-center gap-2 card px-2 py-1">
                  <span className="text-xs truncate max-w-[140px]">{r.name}</span>
                  <button type="button" className="text-xs text-red-600" onClick={() => removeRefImage(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">แนบได้สูงสุด {MAX_REF_IMAGES} ภาพ — ถ้าไม่แนบเลย ระบบจะสร้างภาพจากจินตนาการล้วนๆ (ไม่แนะนำถ้าต้องการให้ตรงกับสินค้าจริง)</p>
        </div>

        {activeTemplate?.needsTheme && (
          <div>
            <label className="field-label">ธีม/เทศกาล *</label>
            <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="เช่น วันแม่, ปีใหม่, Back to School" />
          </div>
        )}

        {activeTemplate?.needsReviewShot && (
          <div>
            <label className="field-label">Screenshot รีวิวจริง *</label>
            <input ref={reviewInputRef} type="file" accept="image/*" onChange={(e) => handleReviewFile(e.target.files)} />
            {reviewShot && <p className="text-xs text-gray-500 mt-1">แนบแล้ว: {reviewShot.name}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">ราคา/โปรโมชั่น (ไม่บังคับ — ถ้าไม่ใส่ ระบบจะไม่แต่งราคาขึ้นเอง)</label>
            <input type="text" value={priceOrPromo} onChange={(e) => setPriceOrPromo(e.target.value)} placeholder='เช่น "1 ขวด 150.- / 3 ขวด 350.-"' />
          </div>
          <div>
            <label className="field-label">ข้อกำหนดเพิ่มเติม (ไม่บังคับ)</label>
            <input type="text" value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} placeholder="เช่น โทนสีม่วง, ใช้แบบอักษรหนา" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">จำนวนภาพ (1–10)</label>
            <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
            <p className="text-xs text-gray-500 mt-1">จะได้ {count} เวอร์ชันของแนวภาพเดียวกัน ให้เลือกอันที่ดีที่สุด — ไม่ใช่ {count} ไอเดียที่ต่างกัน</p>
          </div>
          <div>
            <label className="field-label">สัดส่วนภาพ</label>
            <select value={size} onChange={(e) => setSize(e.target.value as typeof size)}>
              <option value="1024x1024">สี่เหลี่ยมจัตุรัส (1:1) — ฟีด</option>
              <option value="1024x1536">แนวตั้ง (2:3) — Story/Reels</option>
              <option value="1536x1024">แนวนอน (3:2)</option>
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="button" className="btn-primary" disabled={generating || !productName.trim()} onClick={generate}>
          {generating ? 'กำลังสร้างภาพ...' : `สร้างภาพ (${count} ภาพ)`}
        </button>
        <p className="text-xs text-gray-500">ใช้ OpenAI Image API — มีค่าใช้จ่ายตามการใช้งานจริงของ OpenAI ต่อภาพ ยิ่งขอหลายภาพยิ่งใช้เวลานานขึ้น</p>
      </div>

      {results.length > 0 && (
        <div className="card p-6 space-y-3">
          <label className="field-label">ผลลัพธ์ ({results.length} ภาพ)</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.map((url, i) => (
              <div key={i} className="space-y-1">
                <img src={url} alt={`banner-${i}`} className="w-full rounded border" />
                <button type="button" className="btn-secondary text-xs w-full" onClick={() => downloadImage(url, `zana-banner-${Date.now()}-${i}.png`)}>
                  ดาวน์โหลด
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4">
        <label className="field-label">ประวัติงานล่าสุด</label>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีประวัติ</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="border-t pt-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium">{h.product_name} — {TEMPLATE_LABELS[h.template] || h.template}</p>
                    <p className="text-xs text-gray-500">{h.image_count} ภาพ · {new Date(h.created_at).toLocaleString('th-TH')}</p>
                  </div>
                  <button type="button" className="btn-secondary text-xs px-2 py-1" disabled={historyLoading === h.id} onClick={() => loadHistoryImages(h.id)}>
                    {historyLoading === h.id ? '...' : historyImages[h.id] ? 'ซ่อน/แสดงแล้ว' : 'ดูภาพ'}
                  </button>
                </div>
                {historyImages[h.id] && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
                    {historyImages[h.id].map((url, i) => (
                      <img key={i} src={url} alt={`history-${h.id}-${i}`} className="w-full rounded border" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
