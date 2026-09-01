'use client';

import { useRef, useState } from 'react';

// Banner/Ads Image Generator — v2, full two-phase rebuild. Explicit user
// request: pasted their own "E-Commerce Visual Director" system prompt and
// chose "สร้างเต็มรูปแบบ 2 ขั้นตอน (แนะนำ)" over folding it into the old
// single-click batch tool. Two phases:
//   1) วิเคราะห์ — send product facts + photos, AI proposes numbered concepts
//      (or skip straight to "Concept 1-9" without analysis, per the source
//      prompt's own alternate workflow branch).
//   2) สร้างภาพ — pick which proposed concept(s) to actually render; each
//      concept gets its own image-edit call (a real creative direction, not
//      a style variation of one template — that was v1's model).

const MAX_REF_IMAGES = 3;
const MAX_FILE_BYTES = 3 * 1024 * 1024; // per-file cap, keeps total request well under Vercel's 4.5MB body limit

// Fallback concept list — mirrors [CONCEPT LOGIC] in the system prompt.
// Used for the "ข้ามขั้นตอนวิเคราะห์ สร้าง Concept 1-9 ทันที" quick path,
// and as the seed when the user wants to add a concept by hand.
const STANDARD_CONCEPTS: { id: number; name: string; funnel_stage: string; description: string }[] = [
  { id: 1, name: 'Hero Product / Main Cover', funnel_stage: 'Awareness', description: 'ภาพหลักโชว์สินค้าเป็นพระเอก ใช้เป็นภาพปก/ภาพตะกร้าแรกที่ลูกค้าเห็น' },
  { id: 2, name: 'Pain / Problem Awareness', funnel_stage: 'Awareness', description: 'สื่อสารปัญหาที่ลูกค้าเจอ ก่อนเสนอสินค้าเป็นทางออก' },
  { id: 3, name: 'Benefit / Why Use', funnel_stage: 'Consideration', description: 'เน้นประโยชน์หลักที่ยืนยันได้ว่าทำไมต้องใช้สินค้านี้' },
  { id: 4, name: 'Ingredient / Key Extract', funnel_stage: 'Consideration', description: 'โชว์ส่วนผสม/สารสกัดเด่น พร้อมภาพประกอบที่สื่อถึงส่วนผสมนั้น' },
  { id: 5, name: 'Suitable For / Who Is It For', funnel_stage: 'Consideration', description: 'สื่อสารว่าเหมาะกับใคร ช่วงวัยไหน ใช้บริเวณไหนได้' },
  { id: 6, name: 'How To Use', funnel_stage: 'Consideration', description: 'อธิบายขั้นตอนการใช้งานแบบเข้าใจง่าย' },
  { id: 7, name: 'Formula / Gentle / Free-from / Trust Point', funnel_stage: 'Trust', description: 'เน้นจุดที่สร้างความมั่นใจ เช่น สูตรอ่อนโยน ปราศจากสารที่ระบุจริง' },
  { id: 8, name: 'Marketplace Clean Card / Product Info Summary', funnel_stage: 'Conversion', description: 'การ์ดสรุปข้อมูลสินค้าแบบสะอาด ใช้เป็นภาพตะกร้าใน Marketplace' },
  { id: 9, name: 'Registration / Proof / Verified Info', funnel_stage: 'Trust', description: 'สื่อสารเลขจดแจ้ง/ข้อมูลอ้างอิงที่ตรวจสอบได้ (ใช้เฉพาะข้อมูลที่ยืนยันแล้วเท่านั้น)' }
];

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
  template: string; // now holds the concept name, not a fixed enum value (v1 legacy column name)
  image_count: number;
  created_at: string;
}

interface Props {
  history: HistoryItem[];
}

interface AnalysisConcept {
  id: number;
  name: string;
  funnel_stage?: string;
  description: string;
  priority?: number;
}

interface AnalysisResult {
  product_summary: string;
  selling_points: string[];
  bottlenecks: string[];
  concepts: AnalysisConcept[];
  top_priority_ids: number[];
}

interface GenerateResultItem {
  concept_id: number;
  concept_name: string;
  job_id: string | null;
  created_at: string;
  signed_urls: string[];
  error?: string;
}

export default function BannerGeneratorClient({ history: initialHistory }: Props) {
  // Product facts — matches the system prompt's [INPUT] block field-for-field.
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [onPackText, setOnPackText] = useState('');
  const [ageSizeQty, setAgeSizeQty] = useState('');
  const [registrationInfo, setRegistrationInfo] = useState('');
  const [priceOrPromo, setPriceOrPromo] = useState('');
  const [marketplace, setMarketplace] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1024x1024' | '1024x1536' | '1536x1024'>('1024x1024');
  const [prohibitions, setProhibitions] = useState('');
  const [conceptCount, setConceptCount] = useState(9);

  const [refImages, setRefImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [styleRef, setStyleRef] = useState<{ name: string; dataUrl: string } | null>(null);
  const refInputRef = useRef<HTMLInputElement | null>(null);
  const styleInputRef = useRef<HTMLInputElement | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedConceptIds, setSelectedConceptIds] = useState<Set<number>>(new Set());
  const [versionsPerConcept, setVersionsPerConcept] = useState(1);

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerateResultItem[]>([]);
  const [error, setError] = useState('');

  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [historyImages, setHistoryImages] = useState<Record<string, string[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

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

  function removeRefImage(idx: number) {
    setRefImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleStyleRefFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_FILE_BYTES) {
      setError(`ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB)`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setStyleRef({ name: file.name, dataUrl });
    } catch {
      setError('อ่านไฟล์ตัวอย่างสไตล์ไม่สำเร็จ');
    }
    if (styleInputRef.current) styleInputRef.current.value = '';
  }

  function productInfoPayload() {
    return {
      product_name: productName.trim(),
      category: category.trim() || undefined,
      selling_points: sellingPoints.trim() || undefined,
      on_pack_text: onPackText.trim() || undefined,
      age_size_qty: ageSizeQty.trim() || undefined,
      registration_info: registrationInfo.trim() || undefined,
      price_or_promo: priceOrPromo.trim() || undefined,
      marketplace: marketplace.trim() || undefined,
      aspect_ratio: aspectRatio,
      prohibitions: prohibitions.trim() || undefined,
      reference_images: refImages.map((r) => r.dataUrl)
    };
  }

  async function analyze() {
    if (!productName.trim()) {
      setError('กรุณาใส่ชื่อสินค้า');
      return;
    }
    if (refImages.length === 0) {
      setError('กรุณาแนบภาพสินค้าจริงอย่างน้อย 1 ภาพก่อนวิเคราะห์');
      return;
    }
    setError('');
    setAnalyzing(true);
    setAnalysis(null);
    setResults([]);
    try {
      const res = await fetch('/api/tools/banner-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'analyze', ...productInfoPayload(), concept_count: conceptCount })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'วิเคราะห์ไม่สำเร็จ');
      setAnalysis(json.analysis);
      setSelectedConceptIds(new Set<number>(json.analysis?.top_priority_ids || []));
    } catch (err: any) {
      setError(err?.message || 'วิเคราะห์ไม่สำเร็จ');
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleConcept(id: number) {
    setSelectedConceptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generateFromConcepts(concepts: AnalysisConcept[]) {
    if (!productName.trim()) {
      setError('กรุณาใส่ชื่อสินค้า');
      return;
    }
    if (refImages.length === 0) {
      setError('กรุณาแนบภาพสินค้าจริงอย่างน้อย 1 ภาพก่อนสร้าง');
      return;
    }
    if (concepts.length === 0) {
      setError('กรุณาเลือก Concept อย่างน้อย 1 อัน');
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
          mode: 'generate',
          ...productInfoPayload(),
          concepts: concepts.map((c) => ({ id: c.id, name: c.name, funnel_stage: c.funnel_stage, description: c.description })),
          versions_per_concept: versionsPerConcept,
          size: aspectRatio,
          style_reference: styleRef?.dataUrl
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างภาพไม่สำเร็จ');

      const resultItems: GenerateResultItem[] = json.results || [];
      setResults(resultItems);
      const newHistory: HistoryItem[] = resultItems
        .filter((r) => r.job_id)
        .map((r) => ({ id: r.job_id as string, product_name: productName.trim(), template: r.concept_name, image_count: r.signed_urls.length, created_at: r.created_at }));
      if (newHistory.length > 0) setHistory((prev) => [...newHistory, ...prev]);
    } catch (err: any) {
      setError(err?.message || 'สร้างภาพไม่สำเร็จ');
    } finally {
      setGenerating(false);
    }
  }

  function generateSelectedFromAnalysis() {
    if (!analysis) return;
    const chosen = analysis.concepts.filter((c) => selectedConceptIds.has(c.id));
    generateFromConcepts(chosen);
  }

  function generateAllStandardConcepts() {
    generateFromConcepts(STANDARD_CONCEPTS);
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

  const totalResultImages = results.reduce((sum, r) => sum + r.signed_urls.length, 0);

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <div>
          <label className="field-label">ชื่อสินค้า *</label>
          <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="เช่น KYRA Alpha 3+ Purple" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">ประเภทสินค้า</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="เช่น แชมพูเด็ก, ครีมทาผิว" />
          </div>
          <div>
            <label className="field-label">Marketplace/ช่องทาง</label>
            <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
              <option value="">ไม่ระบุ</option>
              <option value="Shopee">Shopee</option>
              <option value="Lazada">Lazada</option>
              <option value="TikTok Shop">TikTok Shop</option>
              <option value="Facebook">Facebook</option>
              <option value="Website">Website</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">จุดเด่นที่ยืนยันได้</label>
          <textarea rows={2} value={sellingPoints} onChange={(e) => setSellingPoints(e.target.value)} placeholder="เฉพาะข้อมูลที่ยืนยันจริง — ระบบจะไม่แต่งสรรพคุณเพิ่มเอง" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">ข้อความบนแพ็ก/ข้อความที่ต้องการใส่</label>
            <textarea rows={2} value={onPackText} onChange={(e) => setOnPackText(e.target.value)} />
          </div>
          <div>
            <label className="field-label">อายุที่ใช้ได้/ขนาด/ปริมาณ</label>
            <input type="text" value={ageSizeQty} onChange={(e) => setAgeSizeQty(e.target.value)} placeholder="เช่น 3+ / 200ml" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">เลขจดแจ้ง/ข้อมูลอ้างอิง (ถ้ามี)</label>
            <input type="text" value={registrationInfo} onChange={(e) => setRegistrationInfo(e.target.value)} placeholder="ใส่เฉพาะเลขจริง — ไม่ใส่ = ระบบจะไม่แต่งขึ้นเอง" />
          </div>
          <div>
            <label className="field-label">ราคา/โปรโมชั่น/CTA (ไม่บังคับ)</label>
            <input type="text" value={priceOrPromo} onChange={(e) => setPriceOrPromo(e.target.value)} placeholder='เช่น "1 ขวด 150.-"' />
          </div>
        </div>

        <div>
          <label className="field-label">ข้อห้ามเฉพาะงานนี้ (ไม่บังคับ)</label>
          <input type="text" value={prohibitions} onChange={(e) => setProhibitions(e.target.value)} placeholder="เช่น ห้ามใส่โลโก้เดิม, ห้ามใส่ราคา, ห้าม redesign สินค้า" />
        </div>

        <div>
          <label className="field-label">ภาพสินค้าจริง * (ใช้เป็น Source of Truth — ไม่ออกแบบสินค้าใหม่)</label>
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
          {refImages.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">⚠ ต้องแนบภาพสินค้าจริงก่อนวิเคราะห์หรือสร้างภาพ — ระบบใช้ภาพนี้เป็นต้นแบบ ไม่วาดสินค้าขึ้นจากจินตนาการ</p>
          )}
        </div>

        <div>
          <label className="field-label">ภาพตัวอย่างสไตล์ที่ต้องการ (ไม่บังคับ)</label>
          <input ref={styleInputRef} type="file" accept="image/*" onChange={(e) => handleStyleRefFile(e.target.files)} />
          {styleRef && (
            <div className="flex items-center gap-2 card px-2 py-1 mt-2 w-fit">
              <span className="text-xs truncate max-w-[180px]">{styleRef.name}</span>
              <button type="button" className="text-xs text-red-600" onClick={() => setStyleRef(null)}>✕</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="field-label">จำนวน Concept ที่ต้องการให้เสนอ</label>
            <input type="number" min={1} max={9} value={conceptCount} onChange={(e) => setConceptCount(Math.min(9, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <label className="field-label">เวอร์ชันต่อ Concept ตอนสร้างจริง</label>
            <input type="number" min={1} max={3} value={versionsPerConcept} onChange={(e) => setVersionsPerConcept(Math.min(3, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <label className="field-label">สัดส่วนภาพ</label>
            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}>
              <option value="1024x1024">สี่เหลี่ยมจัตุรัส (1:1) — ฟีด</option>
              <option value="1024x1536">แนวตั้ง (2:3) — Story/Reels</option>
              <option value="1536x1024">แนวนอน (3:2)</option>
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" disabled={analyzing || generating || !productName.trim()} onClick={analyze}>
            {analyzing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์สินค้า + เสนอ Concept (แนะนำ)'}
          </button>
          <button type="button" className="btn-secondary" disabled={analyzing || generating || !productName.trim()} onClick={generateAllStandardConcepts}>
            {generating ? 'กำลังสร้างภาพ...' : 'ข้ามขั้นตอน สร้าง Concept 1-9 ทันที'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          "วิเคราะห์สินค้า" ให้ AI ดูภาพและข้อมูล แล้วเสนอ Concept ที่เหมาะกับสินค้านี้ก่อน ค่อยเลือกว่าจะสร้างภาพไหน — "ข้ามขั้นตอน" คือสร้างภาพจริงจาก Concept
          มาตรฐานทั้ง 9 ทันทีโดยไม่ต้องรอ AI วิเคราะห์ก่อน
        </p>
      </div>

      {analysis && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="field-label">สรุปภาพรวมสินค้า</label>
            <p className="text-sm">{analysis.product_summary}</p>
          </div>
          {analysis.selling_points.length > 0 && (
            <div>
              <label className="field-label">จุดเด่น/จุดที่ใช้ขายได้</label>
              <ul className="text-sm list-disc pl-5 space-y-0.5">
                {analysis.selling_points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {analysis.bottlenecks.length > 0 && (
            <div>
              <label className="field-label">Bottleneck/สิ่งที่ต้องระวัง</label>
              <ul className="text-sm list-disc pl-5 space-y-0.5 text-amber-700">
                {analysis.bottlenecks.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          <div>
            <label className="field-label">Concept ที่ควรทำ — เลือก Concept ที่จะสร้างภาพจริง</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analysis.concepts.map((c) => {
                const isTop = analysis.top_priority_ids.includes(c.id);
                const checked = selectedConceptIds.has(c.id);
                return (
                  <label key={c.id} className={`card p-3 cursor-pointer block ${checked ? 'ring-2 ring-blue-500' : ''}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={checked} onChange={() => toggleConcept(c.id)} className="mt-1" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          #{c.id} {c.name} {isTop && <span className="text-xs text-blue-600">★ Priority สูงสุด</span>}
                        </p>
                        {c.funnel_stage && <p className="text-xs text-gray-500">{c.funnel_stage}</p>}
                        <p className="text-xs text-gray-600 mt-0.5">{c.description}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <button type="button" className="btn-primary" disabled={generating || selectedConceptIds.size === 0} onClick={generateSelectedFromAnalysis}>
            {generating ? 'กำลังสร้างภาพ...' : `สร้างภาพจาก Concept ที่เลือก (${selectedConceptIds.size})`}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="card p-6 space-y-4">
          <label className="field-label">ผลลัพธ์ ({totalResultImages} ภาพ, {results.length} Concept)</label>
          {results.map((r) => (
            <div key={r.concept_id} className="space-y-2">
              <p className="text-sm font-medium">#{r.concept_id} {r.concept_name}</p>
              {r.error ? (
                <p className="text-xs text-red-600">✕ Concept นี้สร้างไม่สำเร็จ: {r.error}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {r.signed_urls.map((url, i) => (
                    <div key={i} className="space-y-1">
                      <img src={url} alt={`${r.concept_name}-${i}`} className="w-full rounded border" />
                      <button type="button" className="btn-secondary text-xs w-full" onClick={() => downloadImage(url, `zana-banner-${r.concept_id}-${Date.now()}-${i}.png`)}>
                        ดาวน์โหลด
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
                    <p className="text-sm font-medium">{h.product_name} — {h.template}</p>
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
