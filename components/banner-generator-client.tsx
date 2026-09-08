'use client';

import { useState } from 'react';
import { createProductQuick } from '@/app/(dashboard)/products/actions';
import { LibraryImagePicker } from '@/components/library-image-picker';
import { AD_VISUAL_STRATEGIES, buildConceptImagePrompt, findAdVisualStrategy, type ConceptInput, type ProductInfo } from '@/prompts/banner-generator';

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

// Must match the server's zod limits in app/api/tools/banner-generator/generate/route.ts
// (productInfoShape) — kept as constants here so the textarea maxLength/
// counters can't drift out of sync with what the API will actually accept.
const SELLING_POINTS_MAX = 3000;
const PROHIBITIONS_MAX = 2000;

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

interface HistoryItem {
  id: string;
  product_name: string;
  template: string; // now holds the concept name, not a fixed enum value (v1 legacy column name)
  image_count: number;
  created_at: string;
}

interface ProductRecord {
  id: string;
  product_name: string;
  brand: string;
  category?: string | null;
  usp?: string | null;
  ingredients?: string | null;
  benefits?: string | null;
  usage?: string | null;
  allowed_claims?: string | null;
  banned_claims?: string | null;
  compliance_notes?: string | null;
  selling_price?: number | null;
  promotion_price?: number | null;
}

interface KnowledgeItemRecord {
  id: string;
  title: string;
  type: string;
  content: string;
  product_ids?: string[] | null;
}

interface Props {
  history: HistoryItem[];
  // Both optional — the standalone /banner-generator page (kept working but
  // no longer linked from nav) doesn't pass these; the Creative Generator
  // tab does. Explicit user request: pull existing Products/Knowledge Base
  // data into this form as selectable options instead of retyping every
  // time, with a way to save a genuinely new product straight into the
  // catalog from here.
  products?: ProductRecord[];
  knowledgeItems?: KnowledgeItemRecord[];
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

export default function BannerGeneratorClient({ history: initialHistory, products: initialProducts, knowledgeItems }: Props) {
  // Product facts — matches the system prompt's [INPUT] block field-for-field.
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
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
  // Ad Visual Strategy — explicit user request: "เพิ่มตัวเลือกกลยุทธ์การทำภาพ
  // ADS เป็นตัวเลือกสไตล์ภาพ". Stores only the key; the actual instruction
  // text lives server-side (prompts/banner-generator.ts) so it can never be
  // tampered with via the request body.
  const [adStrategyKey, setAdStrategyKey] = useState('');

  // Product/Knowledge Base picker — explicit user request: "อยากให้เพิ่มการนำ
  // Knowledge base หรือ Product สินค้าแสดงเป็นตัวเลือกเพื่อจะได้ไม่ต้องกรอกใหม่
  // และถ้าอันไหนเป็นสินค้าใหม่ ไม่มีในคลัง ให้กดเพิ่มข้อมูลใหม่ตามนี้เลยก็ได้".
  const [products, setProducts] = useState<ProductRecord[]>(initialProducts || []);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productSaveMsg, setProductSaveMsg] = useState('');

  // Storage paths now, not base64 data URLs — real bug fix (see route.ts):
  // inlining reference photo bytes into this route's JSON body could exceed
  // Vercel's hard 4.5MB request limit, which fails BEFORE the app's own code
  // even runs, surfacing as an unparseable "Request En[tity Too Large]..."
  // response instead of any error this app controls. LibraryImagePicker
  // uploads straight to Storage and hands back paths instead.
  const [refImagePaths, setRefImagePaths] = useState<string[]>([]);
  const [styleRefPaths, setStyleRefPaths] = useState<string[]>([]);

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

  function formatPrice(product: ProductRecord): string {
    const promo = product.promotion_price;
    const normal = product.selling_price;
    if (promo && normal && promo !== normal) return `${promo} บาท (ราคาปกติ ${normal} บาท)`;
    if (promo) return `${promo} บาท`;
    if (normal) return `${normal} บาท`;
    return '';
  }

  // Autofill from an existing Products row + any linked Knowledge Base
  // entries (type PRODUCT = verified selling points, type COMPLIANCE =
  // claim restrictions) — the two sources this was explicitly asked for.
  // Fields with no matching column in `products` (on-pack text, age/size,
  // registration number) are deliberately left as-is for the user to fill —
  // no source of truth for those exists in the catalog, so nothing is
  // invented here.
  function applyProduct(productId: string) {
    setSelectedProductId(productId);
    setProductSaveMsg('');
    if (!productId) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return;

    setProductName(p.product_name);
    setBrand(p.brand || '');
    setCategory(p.category || '');

    const sellingPointParts: string[] = [];
    if (p.usp) sellingPointParts.push(`จุดขายหลัก: ${p.usp}`);
    if (p.benefits) sellingPointParts.push(`คุณประโยชน์: ${p.benefits}`);
    if (p.ingredients) sellingPointParts.push(`ส่วนผสม: ${p.ingredients}`);
    if (p.usage) sellingPointParts.push(`วิธีใช้: ${p.usage}`);

    const prohibitionParts: string[] = [];
    if (p.banned_claims) prohibitionParts.push(`ห้ามใช้ claim: ${p.banned_claims}`);
    if (p.compliance_notes) prohibitionParts.push(`ข้อควรระวัง: ${p.compliance_notes}`);

    const linkedKnowledge = (knowledgeItems || []).filter((k) => (k.product_ids || []).includes(productId));
    for (const k of linkedKnowledge) {
      if (k.type === 'PRODUCT') sellingPointParts.push(`[Knowledge Base — ${k.title}] ${k.content}`);
      if (k.type === 'COMPLIANCE') prohibitionParts.push(`[Knowledge Base — ${k.title}] ${k.content}`);
    }

    // Combining Products + multiple Knowledge Base entries can legitimately
    // exceed the API's length limit — truncate defensively here (with a
    // visible notice) instead of letting the user hit a raw "String must
    // contain at most N character(s)" error on submit.
    const combinedSellingPoints = sellingPointParts.join('\n');
    const combinedProhibitions = prohibitionParts.join('\n');
    const truncatedSelling = combinedSellingPoints.length > SELLING_POINTS_MAX;
    const truncatedProhibitions = combinedProhibitions.length > PROHIBITIONS_MAX;

    setSellingPoints(truncatedSelling ? combinedSellingPoints.slice(0, SELLING_POINTS_MAX) : combinedSellingPoints);
    setProhibitions(truncatedProhibitions ? combinedProhibitions.slice(0, PROHIBITIONS_MAX) : combinedProhibitions);
    setPriceOrPromo(formatPrice(p));

    if (truncatedSelling || truncatedProhibitions) {
      setProductSaveMsg('⚠ ข้อมูลจากคลัง/Knowledge Base ยาวเกินขีดจำกัด ระบบตัดข้อความส่วนเกินออกให้อัตโนมัติ — ลองแก้ไขให้กระชับขึ้นก่อนสร้างภาพ');
    }
  }

  async function saveNewProduct() {
    if (!productName.trim() || !brand.trim()) {
      setProductSaveMsg('กรุณากรอกชื่อสินค้าและแบรนด์ก่อนบันทึก');
      return;
    }
    setSavingProduct(true);
    setProductSaveMsg('');
    try {
      const result = await createProductQuick({
        brand: brand.trim(),
        product_name: productName.trim(),
        category: category.trim() || null,
        usp: sellingPoints.trim() || null,
        allowed_claims: null,
        banned_claims: null,
        compliance_notes: prohibitions.trim() || null,
        selling_price: null,
        promotion_price: null
      });
      if ('error' in result) {
        setProductSaveMsg(`บันทึกไม่สำเร็จ: ${result.error}`);
        return;
      }
      const newProduct: ProductRecord = { id: result.id, product_name: result.product_name, brand: result.brand };
      setProducts((prev) => [newProduct, ...prev]);
      setSelectedProductId(result.id);
      setProductSaveMsg(`บันทึก "${result.product_name}" เป็นสินค้าใหม่ในคลังแล้ว — ครั้งหน้าเลือกจากรายการได้เลย`);
    } catch (err: any) {
      setProductSaveMsg(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingProduct(false);
    }
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
      reference_images: refImagePaths,
      ad_strategy_key: adStrategyKey || undefined
    };
  }

  // Mirrors toProductInfo() in app/api/tools/banner-generator/generate/route.ts
  // but built client-side — buildConceptImagePrompt() is a pure string
  // function with no server-only dependency, so it's safe to call directly
  // here and get byte-for-byte the same prompt the server would send to
  // OpenAI. Lets the user preview/copy a concept's exact prompt WITHOUT
  // spending an API call — explicit user request: "อยากให้มีด้วยเพื่อป้องกัน
  // การสร้างภาพไม่สำเร็จและไม่สวยงาม" (want this so they can sanity-check or
  // finish in ChatGPT themselves instead of risking a failed/ugly generation).
  function toProductInfoForPrompt(): ProductInfo {
    return {
      productName: productName.trim(),
      category: category.trim() || undefined,
      sellingPoints: sellingPoints.trim() || undefined,
      onPackText: onPackText.trim() || undefined,
      ageSizeQty: ageSizeQty.trim() || undefined,
      registrationInfo: registrationInfo.trim() || undefined,
      priceOrPromo: priceOrPromo.trim() || undefined,
      marketplace: marketplace.trim() || undefined,
      aspectRatio: aspectRatio,
      prohibitions: prohibitions.trim() || undefined,
      adStrategy: findAdVisualStrategy(adStrategyKey)
    };
  }

  const [promptCopyMsg, setPromptCopyMsg] = useState('');

  // AnalysisConcept (this file, snake_case funnel_stage) -> ConceptInput
  // (prompts/banner-generator.ts, camelCase funnelStage) — same field rename
  // generateFromConcepts() already does when building the API payload.
  function toConceptInput(c: AnalysisConcept): ConceptInput {
    return { id: c.id, name: c.name, funnelStage: c.funnel_stage, description: c.description };
  }

  function copyPromptForConcept(concept: AnalysisConcept) {
    const prompt = buildConceptImagePrompt(toProductInfoForPrompt(), toConceptInput(concept));
    navigator.clipboard.writeText(prompt);
    setPromptCopyMsg(`✓ คัดลอก Prompt "${concept.name}" แล้ว — ไปวางใน ChatGPT ได้เลย (อย่าลืมแนบรูปสินค้าเดียวกันไปด้วย)`);
    setTimeout(() => setPromptCopyMsg(''), 4000);
  }

  function copyPromptsForSelected() {
    const chosen = analysis?.concepts.filter((c) => selectedConceptIds.has(c.id)) || [];
    if (chosen.length === 0) return;
    const info = toProductInfoForPrompt();
    const text = chosen
      .map((c, i) => `${'='.repeat(20)} Concept ${i + 1}/${chosen.length}: ${c.name} ${'='.repeat(20)}\n\n${buildConceptImagePrompt(info, toConceptInput(c))}`)
      .join('\n\n\n');
    navigator.clipboard.writeText(text);
    setPromptCopyMsg(`✓ คัดลอก Prompt ทั้งหมด ${chosen.length} Concept แล้ว — อย่าลืมแนบรูปสินค้าเดียวกันไปด้วยตอนวางใน ChatGPT`);
    setTimeout(() => setPromptCopyMsg(''), 4000);
  }

  async function analyze() {
    if (!productName.trim()) {
      setError('กรุณาใส่ชื่อสินค้า');
      return;
    }
    if (refImagePaths.length === 0) {
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
    if (refImagePaths.length === 0) {
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
          style_reference: styleRefPaths[0]
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
        {products.length > 0 && (
          <div>
            <label className="field-label">เลือกสินค้าจากคลัง (ไม่บังคับ — ไม่ต้องกรอกใหม่)</label>
            <select value={selectedProductId} onChange={(e) => applyProduct(e.target.value)}>
              <option value="">— กรอกข้อมูลสินค้าใหม่เอง —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.brand} — {p.product_name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              เลือกแล้วระบบจะดึงข้อมูลจาก Products และ Knowledge Base ที่เชื่อมกับสินค้านี้มาใส่ให้อัตโนมัติ (แก้ไขต่อได้) —
              ยังต้องแนบรูปสินค้าเองอยู่ดี เพราะคลังสินค้ายังไม่ได้เก็บรูปไว้
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">ชื่อสินค้า *</label>
            <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="เช่น KYRA Alpha 3+ Purple" />
          </div>
          <div>
            <label className="field-label">แบรนด์ {selectedProductId ? '' : '(ใส่ไว้เผื่อกด "บันทึกเป็นสินค้าใหม่")'}</label>
            <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="เช่น ZANA, ZANA Kid, KYRA" />
          </div>
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
          <textarea
            rows={3}
            maxLength={SELLING_POINTS_MAX}
            value={sellingPoints}
            onChange={(e) => setSellingPoints(e.target.value)}
            placeholder="เฉพาะข้อมูลที่ยืนยันจริง — ระบบจะไม่แต่งสรรพคุณเพิ่มเอง"
          />
          <p className={`text-xs mt-0.5 ${sellingPoints.length > SELLING_POINTS_MAX * 0.9 ? 'text-amber-600' : 'text-gray-400'}`}>
            {sellingPoints.length.toLocaleString()} / {SELLING_POINTS_MAX.toLocaleString()} ตัวอักษร
          </p>
        </div>

        {!selectedProductId && (
          <div>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={savingProduct || !productName.trim() || !brand.trim()}
              onClick={saveNewProduct}
            >
              {savingProduct ? 'กำลังบันทึก...' : '＋ บันทึกเป็นสินค้าใหม่ในคลัง (Products)'}
            </button>
            {productSaveMsg && <p className="text-xs mt-1 text-gray-600">{productSaveMsg}</p>}
          </div>
        )}

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
          <textarea
            rows={3}
            maxLength={PROHIBITIONS_MAX}
            value={prohibitions}
            onChange={(e) => setProhibitions(e.target.value)}
            placeholder="เช่น ห้ามใส่โลโก้เดิม, ห้ามใส่ราคา, ห้าม redesign สินค้า"
          />
          <p className={`text-xs mt-0.5 ${prohibitions.length > PROHIBITIONS_MAX * 0.9 ? 'text-amber-600' : 'text-gray-400'}`}>
            {prohibitions.length.toLocaleString()} / {PROHIBITIONS_MAX.toLocaleString()} ตัวอักษร
          </p>
        </div>

        <div>
          <label className="field-label">กลยุทธ์การทำภาพ ADS (ไม่บังคับ — เลือกมุมมองทางจิตวิทยา/สไตล์ภาพ)</label>
          <select value={adStrategyKey} onChange={(e) => setAdStrategyKey(e.target.value)}>
            <option value="">— ไม่ระบุ (ให้ AI เลือกให้เหมาะกับสินค้าเอง) —</option>
            {AD_VISUAL_STRATEGIES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name} — {s.tagline}
              </option>
            ))}
          </select>
          {adStrategyKey && (
            <p className="text-xs text-gray-500 mt-1">{AD_VISUAL_STRATEGIES.find((s) => s.key === adStrategyKey)?.guidance}</p>
          )}
        </div>

        <div>
          <LibraryImagePicker
            name="ref_images"
            label="ภาพสินค้าจริง * (ใช้เป็น Source of Truth — ไม่ออกแบบสินค้าใหม่)"
            folder="banner-refs"
            maxFiles={MAX_REF_IMAGES}
            onChange={setRefImagePaths}
            help={`อัปโหลดตรงไปที่ Storage ไม่ผ่าน API เลย — ไม่ติด limit ขนาดไฟล์ 4.5MB แบบเมื่อก่อน สูงสุด ${MAX_REF_IMAGES} ไฟล์`}
          />
          {refImagePaths.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">⚠ ต้องแนบภาพสินค้าจริงก่อนวิเคราะห์หรือสร้างภาพ — ระบบใช้ภาพนี้เป็นต้นแบบ ไม่วาดสินค้าขึ้นจากจินตนาการ</p>
          )}
        </div>

        <div>
          <LibraryImagePicker
            name="style_reference"
            label="ภาพตัวอย่างสไตล์ที่ต้องการ (ไม่บังคับ)"
            folder="banner-style"
            maxFiles={1}
            multiple={false}
            onChange={setStyleRefPaths}
          />
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
          &ldquo;วิเคราะห์สินค้า&rdquo; ให้ AI ดูภาพและข้อมูล แล้วเสนอ Concept ที่เหมาะกับสินค้านี้ก่อน ค่อยเลือกว่าจะสร้างภาพไหน — &ldquo;ข้ามขั้นตอน&rdquo; คือสร้างภาพจริงจาก Concept
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
                        <button
                          type="button"
                          className="text-xs text-accentBlue mt-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyPromptForConcept(c);
                          }}
                        >
                          📋 Copy Prompt ไป GPT
                        </button>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={generating || selectedConceptIds.size === 0} onClick={generateSelectedFromAnalysis}>
              {generating ? 'กำลังสร้างภาพ...' : `สร้างภาพจาก Concept ที่เลือก (${selectedConceptIds.size})`}
            </button>
            <button type="button" className="btn-secondary" disabled={selectedConceptIds.size === 0} onClick={copyPromptsForSelected}>
              📋 Copy Prompt ทุก Concept ที่เลือกไป GPT
            </button>
            {promptCopyMsg && <span className="text-xs text-accentGreen">{promptCopyMsg}</span>}
          </div>
          <p className="text-xs text-gray-400">
            คัดลอก Prompt แล้วยังไม่แน่ใจผล ลองวางใน ChatGPT ก่อนได้ — Prompt ที่คัดลอกเหมือนกับที่ระบบใช้สร้างภาพจริงทุกตัวอักษร แค่ต้องแนบรูปสินค้าเดียวกันเองตอนวางใน ChatGPT
          </p>
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
