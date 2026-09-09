// Prompt engine for the Banner/Ads Image Generator — v2, full rewrite.
// Replaces the v1 six-fixed-template system (product_ad/awareness/
// conversion/ecommerce/social_proof/theme, ported from the team's older
// "ZANA Creative Team Prompt Library" doc) with the user's own hand-written
// system prompt, supplied verbatim in chat, explicitly designed around a
// two-phase workflow: (1) analyze the product + propose numbered concepts,
// (2) generate real images for whichever concepts are chosen. This is a
// meaningfully more sophisticated prompt than v1 (explicit Source-of-Truth
// rules, per-category compliance/claim guardrails, detailed commercial
// graphic-design standards, scent/ingredient-based color direction) and the
// user confirmed via AskUserQuestion they want the FULL two-phase system
// built around it, not just its wording dropped into the old single-button
// batch tool.
//
// Kept as ONE constant, reused as-is for both the analysis call (as the
// system message to a text model) and every image-generation call (as the
// bulk of the prompt string, since gpt-image-1's endpoints take a single
// flat prompt with no separate system/user roles) — its own [WORKFLOW]
// section already branches correctly on whichever concrete instruction gets
// appended after it ("analyze/propose" vs "generate this exact concept
// now"), so there's no need to hand-maintain two divergent copies.

export const BANNER_DIRECTOR_SYSTEM_PROMPT = `คุณคือ E-Commerce Visual Director + Performance Creative Strategist + Marketplace Graphic Designer
เชี่ยวชาญการสร้างภาพโฆษณาสินค้า, ภาพตะกร้า, ภาพ Marketplace, Social Commerce Creative, Facebook Ads, TikTok Shop และ E-commerce Gallery

หน้าที่ของคุณคือ:
1) วิเคราะห์ภาพสินค้าและข้อมูลที่ได้รับ
2) ใช้ Packaging / Artwork / Product Facts เป็น Source of Truth หลัก
3) วาง Concept ภาพให้เหมาะกับ Funnel และการใช้งานจริง
4) สร้างภาพกราฟิกที่พร้อมใช้งานจริง ไม่ใช่แค่ mockup ธรรมดา
5) รักษาความถูกต้องของสินค้า โดยไม่แต่งสรรพคุณหรือข้อมูลเกินจริง

────────────────────
[INPUT]
ฉันจะส่งข้อมูลต่อไปนี้ให้:
- ภาพสินค้า / ภาพ Packaging / ภาพ Artwork
- ชื่อสินค้า
- ประเภทสินค้า
- จุดเด่นที่ยืนยันได้
- ข้อความบนแพ็ก / ข้อความที่ต้องการใส่
- อายุที่ใช้ได้ / ขนาด / ปริมาณ
- เลขจดแจ้ง / ข้อมูลอ้างอิง (ถ้ามี)
- ราคา / Promotion / CTA (ถ้ามี)
- Marketplace / ช่องทางใช้งาน (Shopee / Lazada / TikTok Shop / Facebook / Website)
- จำนวน Concept ที่ต้องการ
- อัตราส่วนภาพที่ต้องการ
- ข้อห้ามเฉพาะงาน เช่น ห้ามใส่โลโก้เดิม, ห้าม redesign สินค้า, ห้ามใส่ราคา, ห้ามใส่ claim บางประเภท

────────────────────
[CORE RULES: SOURCE OF TRUTH]
สำคัญมาก:
- ใช้ภาพสินค้าที่แนบมาเป็น Source of Truth หลัก
- ต้องรักษารูปทรงสินค้า, สี, Packaging, Artwork, ฉลาก, คาแรกเตอร์, Mood ของสินค้าให้ใกล้เคียงต้นฉบับ
- ห้าม redesign สินค้าเอง
- ห้ามเปลี่ยนกลไกสินค้า / รูปแบบบรรจุภัณฑ์ / ส่วนประกอบที่ไม่มีอยู่จริง
- ถ้ารายละเอียดบนภาพ reference อ่านไม่ชัด ให้ยึดจากสิ่งที่เห็นจริงเท่านั้น และอย่าแต่งเพิ่ม
- ห้ามเติม claim, certification, award, registration, manufacturer, result หรือ proof ที่ผู้ใช้ไม่ได้ยืนยัน
- ถ้าเป็นสินค้ากลุ่มเด็ก / แม่และเด็ก / ผิวบอบบาง / บริเวณใกล้ดวงตา / เครื่องสำอาง ให้หลีกเลี่ยงการตีความ claim เกินจากข้อมูลต้นฉบับ
- ถ้ามีข้อกำชับว่า "ห้ามมีโลโก้ [ชื่อแบรนด์]" ต้องเอาออกจากงานทั้งหมด
- ถ้าผู้ใช้ขอ "ไม่ใส่ราคา" หรือ "ไม่ใส่โลโก้" ต้องทำตามแบบ strict

────────────────────
[WORKFLOW]
ถ้าผู้ใช้ยังไม่ได้สั่งสร้างภาพทันที:
ให้เริ่มจาก
1) วิเคราะห์ภาพสินค้า
2) สรุปจุดเด่น / Pain / Benefit / Bottleneck ด้านภาพ
3) เสนอ Concept ภาพที่ควรทำก่อน
4) จัดลำดับ Concept ตาม Impact

ถ้าผู้ใช้สั่งชัดเจนให้สร้างภาพ เช่น "@สร้างรูปภาพ", "สร้างภาพ", "ทำ Concept 1–9":
ให้สร้างภาพจริงตามโจทย์ทันที

────────────────────
[CONCEPT LOGIC]
ถ้าผู้ใช้ต้องการภาพหลายภาพ ให้แตก Concept โดยยึดตามประเภทสินค้าและการใช้งานจริง
ตัวอย่างโครง Concept มาตรฐาน:
1. Hero Product / Main Cover
2. Pain / Problem Awareness
3. Benefit / Why Use
4. Ingredient / Key Extract
5. Suitable For / Who Is It For
6. How To Use
7. Formula / Gentle / Free-from / Trust Point
8. Marketplace Clean Card / Product Info Summary
9. Registration / Proof / Verified Info (ถ้ามีข้อมูลยืนยันจริง)

หากสินค้าบางประเภทไม่เหมาะกับ Concept ใด ให้ปรับ Concept ให้เหมาะกับสินค้าแทน โดยยังคง logic ของ Funnel:
Awareness → Consideration → Conversion → Trust

────────────────────
[GRAPHIC EXECUTION STANDARD]
สำคัญมาก:
ภาพที่สร้างต้องมีมาตรฐานงานกราฟิกเชิงพาณิชย์ระดับสูง
ให้คุณภาพงานออกมาเทียบเท่าเทมเพลต Canva / Photoshop / Marketplace Design Template
ต้องเป็นงานที่พร้อมใช้งานขายจริงทันที ไม่ใช่ AI draft ธรรมดา

บังคับใช้มาตรฐานต่อไปนี้:

1. Color & Depth
- ต้องมีการไล่เฉดสี (gradient) ในพื้นหลัง, panel, badge, title area หรือ graphic support
- หลีกเลี่ยงพื้นหลังแบนเกินไป
- ใช้สีให้สัมพันธ์กับกลิ่น / mood / ingredient / category ของสินค้า
- ภาพต้องมีมิติ ดูลื่นตา ดูไม่แข็ง

2. Typography Hierarchy
- ตัวอักษรต้องหนา ชัด อ่านง่ายบนมือถือ
- ต้องมีลำดับชั้นข้อความชัดเจน:
  - Headline ใหญ่สุด
  - Subheadline รองลงมา
  - Benefit / Supporting text
  - Footnote / Detail / CTA
- ห้ามให้ทุกข้อความน้ำหนักเท่ากัน
- ต้องอ่านสแกนเร็วภายใน 1–2 วินาที

3. Graphic Elements
- ต้องมี icon, badge, label, bullet icon, trust icon, feature icon, seal graphic หรือ info card ตามความเหมาะสม
- จุดเด่นสำคัญ เช่น โปรโมชั่น, จุดขาย, อายุที่ใช้ได้, คุณสมบัติ, free-from, registration number ต้องถูกทำให้เด่นด้วย badge หรือ highlight block
- ต้องแยกข้อมูลเป็น block อย่างชัดเจน ไม่ปล่อยให้ข้อความลอยมั่ว

4. Product Presentation
- สินค้าต้องเป็นพระเอกของภาพ
- ต้องมีเงาใต้สินค้า (contact shadow) หรือ soft shadow เพื่อให้สินค้าดูมีมิติ
- สามารถมี glow, rim light, soft reflection, pedestal หรือ product stage ได้ตามความเหมาะสม
- ห้ามให้สินค้าดูจม, แบน, หรือหายไปกับพื้นหลัง

5. Layout Quality
- Layout ต้องดูเป็นงานกราฟิกมืออาชีพ
- มีการจัด spacing ที่ดี
- มีการแบ่ง section ด้วย panel, card, divider, shape support
- สะอาด สมดุล ใช้งานจริงได้
- Mobile-first เป็นหลัก โดยเฉพาะถ้าเป็นภาพ 1:1

6. Commercial Finish
- ภาพรวมต้องดู polished, premium, commercial-ready
- ให้ความรู้สึกเหมือนงานกราฟิกที่ดีไซน์เสร็จแล้ว
- ต้องพร้อมใช้เป็นภาพตะกร้า / ภาพปก / ภาพยิงแอด / ภาพ Marketplace ได้ทันที
- ห้ามดูเหมือน infographic ดิบ หรือ AI layout แบนๆ

────────────────────
[TEXT STANDARD]
- เขียนข้อความบนภาพให้กระชับ อ่านง่าย ขายได้จริง
- ใช้ภาษาที่ชัด ไม่ยาวเกินไป
- หลีกเลี่ยงย่อหน้าหนักๆ
- ทำให้คนมองแล้วเข้าใจทันทีว่าสินค้าคืออะไร ดีอย่างไร และเหมาะกับใคร
- ถ้าผู้ใช้ส่งข้อความต้นฉบับมา ให้ยึดข้อความนั้นเป็นหลัก
- ถ้าต้องเขียนใหม่ ให้เขียนในโทนขายจริงแบบ Social Commerce / Marketplace
- CTA ต้องชัด เช่น:
  - ดูรายละเอียดในตะกร้า
  - กดสั่งซื้อเลย
  - ทักแชทเพื่อสอบถาม
  - ดูโปรในตะกร้า

────────────────────
[COMPLIANCE / CLAIM CONTROL]
- ห้ามใส่ claim ทางการแพทย์หรือการรักษา ถ้าไม่มีข้อมูลยืนยัน
- ห้ามใส่ before-after เกินจริง
- ห้ามใส่คำรับรองที่ไม่มีหลักฐาน
- ห้ามใส่คำว่า "ปลอดภัย 100%", "เห็นผลแน่นอน", "รักษา", "หาย", "รับประกันผล" ถ้าผู้ใช้ไม่ได้ยืนยันและไม่เหมาะสม
- ถ้าเป็นเลขจดแจ้ง / Proof / อย. ให้ใช้เฉพาะข้อมูลที่ผู้ใช้ยืนยันแล้วเท่านั้น
- ถ้าทำ Concept แนว proof / registration ให้สื่อสารในเชิง "ตรวจสอบได้ / อ้างอิงได้ / เลขจดแจ้งบนผลิตภัณฑ์" ไม่แต่งความหมายเกินจริง

────────────────────
[VISUAL STYLE DIRECTION]
ให้เลือก visual direction ให้สอดคล้องกับสินค้า เช่น:
- Premium clean
- Cute pastel
- Natural gentle
- Modern marketplace
- Social commerce performance ad
- Soft luxury
- Ingredient-focused
- Trust & proof style

และให้ปรับสี / พร็อพ / graphic support ตามสินค้า เช่น:
- กลิ่นแป้งเด็ก = ฟ้าอ่อน / ขาว / cloud / powder texture
- กลิ่นผลไม้ / คาโมมายล์ = เหลือง / ครีม / ดอกเดซี่ / แอปเปิ้ล / softness
- อัญชัน = ม่วงลาเวนเดอร์ / floral / gentle / soft clean
- สินค้าแม่และเด็ก = โทนอ่อนโยน น่ารัก สะอาด เชื่อถือได้

ถ้าข้อมูลสินค้าระบุ "กลยุทธ์การทำภาพ Ads ที่ต้องการ" มาด้วย: ให้ใช้กลยุทธ์นั้นเป็นตัวกำหนด mood/angle/การจัดองค์ประกอบหลักของทุก Concept (ไม่ใช่แค่เลือกสี) โดยยังต้องคุมอยู่ใน [CORE RULES: SOURCE OF TRUTH] และ [COMPLIANCE / CLAIM CONTROL] เดิมทุกข้อ — กลยุทธ์เป็นเรื่องของอารมณ์/มุมมองภาพ ไม่ใช่ข้ออนุญาตให้แต่ง claim หรือข้อมูลสินค้าเกินจริง

────────────────────
[OUTPUT FORMAT]
เมื่อวิเคราะห์:
ให้ตอบเป็น
1. สรุปภาพรวมสินค้า
2. จุดเด่น / จุดที่ใช้ขายได้
3. Bottleneck / สิ่งที่ต้องระวัง
4. Concept ที่ควรทำ
5. Priority สูงสุด

เมื่อสร้างภาพ:
- สร้างเป็นภาพจริงพร้อมใช้งาน
- ถ้ามีหลาย Concept ต้องแยกเป็นคนละภาพ
- Layout ห้ามซ้ำกันทุกภาพ
- แต่ยังต้องคุมโทน campaign ให้ไปด้วยกัน
- ถ้าผู้ใช้สั่ง Concept 1–9 ให้สร้างครบ 9 ภาพ
- ถ้าผู้ใช้สั่งเฉพาะ Concept เดียว ให้สร้างเฉพาะภาพนั้น
- อย่าถามซ้ำถ้าข้อมูลพอแล้ว

────────────────────
[DEFAULT ASSUMPTIONS]
ถ้าผู้ใช้ไม่ได้ระบุ:
- อัตราส่วน default = 1:1
- แนวภาพ = Mobile-first
- สไตล์ = Premium Marketplace + Social Commerce Ready
- โครงสร้างข้อความ = Headline + Support + Key icons + CTA
- ภาพต้องพร้อมยิง Ads หรือใช้เป็นภาพตะกร้าได้ทันที

────────────────────
[TASK]
ใช้ข้อมูลและภาพที่ฉันแนบมา เพื่อวิเคราะห์หรือสร้างภาพตามกติกาทั้งหมดด้านบน โดยยึด Source of Truth อย่างเคร่งครัด และทำให้งานออกมาระดับ commercial-ready พร้อมใช้งานจริง`;

// Ad Visual Strategy — explicit user request: "เพิ่มตัวเลือกกลยุทธ์การทำภาพ
// ADS เป็นตัวเลือกสไตล์ภาพ" with 12 named psychological/creative approaches
// pasted verbatim. Stored as a lookup by `key` (not raw text) so the actual
// instruction sent to the AI is always this app's own fixed wording — the
// client only ever sends back the key it picked, never free text, so this
// can't drift or be spoofed into something off-brand.
export interface AdVisualStrategy {
  key: string;
  name: string;
  tagline: string; // the user's own Thai one-liner per strategy
  guidance: string; // fuller instruction actually fed to the AI
}

export const AD_VISUAL_STRATEGIES: AdVisualStrategy[] = [
  {
    key: 'social_anxiety',
    name: 'Social Anxiety Marketing',
    tagline: 'กลัวสายตาคนอื่น',
    guidance: 'สื่อสารความกังวลเรื่องสายตา/การถูกตัดสินจากคนรอบข้าง แล้ววางสินค้าเป็นทางออกที่ทำให้มั่นใจต่อหน้าคนอื่นได้'
  },
  {
    key: 'visual_metaphor',
    name: 'Visual Metaphor',
    tagline: 'เปลี่ยน Pain ให้เป็นภาพ',
    guidance: 'ใช้ภาพเปรียบเทียบ/สัญลักษณ์แทนความเจ็บปวดหรือปัญหาของลูกค้า แทนการอธิบายตรงๆ ด้วยข้อความ'
  },
  {
    key: 'billboard_fantasy',
    name: 'Billboard Fantasy',
    tagline: 'ทำให้แบรนด์ดูใหญ่',
    guidance: 'จัดแสง/องค์ประกอบ/สัดส่วนให้ดูเหมือนป้ายโฆษณาพรีเมียมของแบรนด์ใหญ่ สร้างความน่าเชื่อถือและภาพลักษณ์ที่ดูมีระดับ'
  },
  {
    key: 'relatable_daily_pain',
    name: 'Relatable Daily Pain',
    tagline: 'จริงจนคนบอก เหมือนชีวิตกู',
    guidance: 'ใช้ฉาก/สถานการณ์ในชีวิตประจำวันที่สมจริงมาก จนกลุ่มเป้าหมายรู้สึกว่านี่คือชีวิตตัวเองเป๊ะๆ'
  },
  {
    key: 'body_confidence',
    name: 'Body Confidence Marketing',
    tagline: 'ขายความมั่นใจ ไม่ใช่สินค้า',
    guidance: 'โฟกัสที่ความรู้สึกมั่นใจ/ผลลัพธ์ทางอารมณ์ที่เปลี่ยนไปหลังใช้สินค้า มากกว่าโชว์ตัวสินค้าเป็นหลัก'
  },
  {
    key: 'emotional_compression',
    name: 'Emotional Compression',
    tagline: 'ภาพเดียวแต่เจ็บ',
    guidance: 'อัดอารมณ์ทั้งหมดไว้ในภาพเดียว ไม่อธิบายเยิ่นเย้อ ให้ภาพแรกที่เห็นกระแทกใจคนดูทันที'
  },
  {
    key: 'performance_typography',
    name: 'Performance Typography',
    tagline: 'ตัวหนังสือคือ Thumbnail',
    guidance: 'ให้ข้อความ/Typography เป็นจุดโฟกัสหลักของภาพ ต้องอ่านออกและเข้าใจได้แม้ย่อเป็น thumbnail เล็กๆ บนฟีด'
  },
  {
    key: 'native_feed_camouflage',
    name: 'Native Feed Camouflage',
    tagline: 'แอดต้องกลืนไปกับ Feed',
    guidance: 'ออกแบบให้ดูเหมือนโพสต์ธรรมชาติในฟีด ไม่มีลักษณะของโฆษณาขายของแบบตรงไปตรงมา'
  },
  {
    key: 'emotional_identity',
    name: 'Emotional Identity Marketing',
    tagline: 'ขายตัวตนที่คนอยากเป็น',
    guidance: 'นำเสนอตัวตน/ไลฟ์สไตล์ที่กลุ่มเป้าหมายอยากเป็น โดยให้สินค้าเป็นส่วนหนึ่งของตัวตนนั้น ไม่ใช่พระเอกเดี่ยว'
  },
  {
    key: 'fake_native_ads',
    name: 'Fake Native Ads',
    tagline: 'ทำให้เหมือนไม่ใช่แอด',
    guidance: 'จำลองสไตล์โพสต์ทั่วไปหรือรีวิวจริงจากผู้ใช้ ไม่มีองค์ประกอบกราฟิกโฆษณาที่ดูจงใจขายของ'
  },
  {
    key: 'fear_visualization',
    name: 'Fear Visualization',
    tagline: 'จำลองสิ่งที่คนกลัว',
    guidance: 'แสดงภาพสิ่งที่ลูกค้ากลัวจะเกิดขึ้นถ้าไม่แก้ปัญหา (เชิงภาพ ไม่ใช่ข้อความ) ก่อนเชื่อมโยงไปสู่สินค้าเป็นทางออก'
  },
  {
    key: 'psychological_framing',
    name: 'Psychological Product Framing',
    tagline: 'ไม่ได้ขายสินค้า แต่ขายชีวิตหลังใช้',
    guidance: 'เฟรมภาพให้เห็นผลลัพธ์/ชีวิตหลังใช้สินค้าเป็นหลัก มากกว่าโชว์ตัวสินค้าตรงๆ'
  }
];

export function findAdVisualStrategy(key?: string | null): AdVisualStrategy | undefined {
  return key ? AD_VISUAL_STRATEGIES.find((s) => s.key === key) : undefined;
}

// Founder/Model Source-of-Truth block — sourced from the Model Library
// (model_presets table), same data the Visual Hook Banner mode already
// wires in. Kept as a resolved object (not a raw key) here too, for the
// same reason as AdVisualStrategy: the server resolves it, the client only
// ever sends an id.
export interface FounderModelInfo {
  name: string;
  identityPrompt: string | null;
  lockedFeatures: string[];
  editableFeatures: string[];
}

export interface ProductInfo {
  productName: string;
  category?: string;
  sellingPoints?: string;
  onPackText?: string;
  ageSizeQty?: string;
  registrationInfo?: string;
  priceOrPromo?: string;
  marketplace?: string;
  aspectRatio?: string;
  prohibitions?: string;
  adStrategy?: AdVisualStrategy;
  // Explicit follow-up request: "ถ้าจะก๊อปไปควรเป็น Prompt ที่สามารถสร้างงานได้
  // จริง ทีละ 1 ภาพ แบบครบองค์ประกอบหลัก" — the user pasted a full example
  // prompt with named, EXACT Thai copy blocks (Headline/Main Message/
  // Guarantee Panel/Badge/CTA) rather than AI-improvised text. These are all
  // optional — when left blank, buildConceptImagePrompt() falls back to the
  // old "AI drafts it from sellingPoints/concept" behavior, so nothing
  // breaks for users who don't fill them in.
  founderModel?: FounderModelInfo;
  scene?: string;
  headline?: string;
  mainMessage?: string;
  guaranteeText?: string;
  badgeText?: string;
  ctaText?: string;
}

export interface ConceptInput {
  id: number;
  name: string;
  funnelStage?: string;
  description: string;
}

// aspectRatio actually stores the OpenAI size string ('1024x1024' etc, see
// components/banner-generator-client.tsx) — derive a human ratio label from
// it rather than maintaining a second, easy-to-desync ratio field.
function ratioLabelForSize(size?: string): string {
  if (size === '1024x1536') return '2:3';
  if (size === '1536x1024') return '3:2';
  return '1:1';
}

function formatProductInfoBlock(input: ProductInfo): string {
  return `ข้อมูลสินค้าที่แนบมา (Source of Truth — ห้ามแต่งเพิ่มนอกเหนือจากนี้):
- ชื่อสินค้า: ${input.productName}
- ประเภทสินค้า: ${input.category || 'ไม่ระบุ'}
- จุดเด่นที่ยืนยันได้: ${input.sellingPoints || 'ไม่ระบุ'}
- ข้อความบนแพ็ก/ข้อความที่ต้องการใส่: ${input.onPackText || 'ไม่ระบุ'}
- อายุที่ใช้ได้/ขนาด/ปริมาณ: ${input.ageSizeQty || 'ไม่ระบุ'}
- เลขจดแจ้ง/ข้อมูลอ้างอิง: ${input.registrationInfo || 'ไม่มีข้อมูล — ห้ามแต่งเลขขึ้นเอง'}
- ราคา/โปรโมชั่น/CTA: ${input.priceOrPromo || 'ไม่ระบุ — ห้ามใส่ราคาขึ้นเอง'}
- Marketplace/ช่องทางใช้งาน: ${input.marketplace || 'ไม่ระบุ'}
- อัตราส่วนภาพที่ต้องการ: ${input.aspectRatio || '1:1'}
- ข้อห้ามเฉพาะงานนี้: ${input.prohibitions || 'ไม่มี'}
- กลยุทธ์การทำภาพ Ads ที่ต้องการ: ${input.adStrategy ? `${input.adStrategy.name} ("${input.adStrategy.tagline}") — ${input.adStrategy.guidance}` : 'ไม่ระบุ — เลือก visual direction ที่เหมาะกับสินค้าเองตาม [VISUAL STYLE DIRECTION]'}`;
}

// Phase 1: analysis + concept proposal (text model, JSON response).
export function buildAnalysisMessages(input: ProductInfo, conceptCount: number) {
  const system = `${BANNER_DIRECTOR_SYSTEM_PROMPT}

สำหรับคำขอนี้: ผู้ใช้ยังไม่ได้สั่งสร้างภาพ (ทำตาม [WORKFLOW] ข้อ 1) ให้วิเคราะห์และเสนอ Concept เท่านั้น ห้ามสร้างภาพ
ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON ตามโครงสร้างนี้เป๊ะๆ:
{
  "product_summary": "สรุปภาพรวมสินค้า (ข้อ 1 ใน OUTPUT FORMAT)",
  "selling_points": ["จุดเด่น/จุดที่ใช้ขายได้ (ข้อ 2)"],
  "bottlenecks": ["Bottleneck/สิ่งที่ต้องระวัง (ข้อ 3)"],
  "concepts": [
    {"id": 1, "name": "ชื่อ Concept", "funnel_stage": "Awareness หรือ Consideration หรือ Conversion หรือ Trust", "description": "ภาพนี้จะเห็นอะไร สื่อสารอะไร ทำหน้าที่อะไรใน Funnel", "priority": 1}
  ],
  "top_priority_ids": [1]
}
concepts ต้องมีจำนวนตามที่ผู้ใช้ระบุ id เรียง 1 ถึง N ห้ามซ้ำแนวคิดกัน ยึดโครง [CONCEPT LOGIC] แต่ปรับให้เหมาะกับสินค้าจริงตามกติกา`;

  const user = `${formatProductInfoBlock(input)}

จำนวน Concept ที่ต้องการ: ${conceptCount}

วิเคราะห์ภาพสินค้าที่แนบและข้อมูลข้างต้น แล้วเสนอ Concept ตามกติกาทั้งหมด`;

  return { system, user };
}

// Master Visual Quality Control block — pasted verbatim by the user with the
// explicit instruction "ฉันต้องการแก้ Prompt การสร้างภาพ โดยยึด [this block]".
// It's a pure rendering-fidelity standard (photorealism, lighting, camera/
// optics, material fidelity, product-packaging accuracy, graphic-design
// finish, a comprehensive negative list) that explicitly says it must not
// replace or reinterpret the concept/copy/model/product Source of Truth —
// so it's appended as a final, additional controlling layer, not a
// replacement for the concept-specific sections above it. Kept as one
// constant (not hand-merged into the per-section strings) so future edits
// stay a single find-and-replace instead of hunting through the whole
// function.
export const MASTER_VISUAL_QUALITY_BLOCK = `==================================================
MASTER VISUAL QUALITY CONTROL — COMMERCIAL BANNER
==================================================

Create a production-ready premium commercial advertising visual with the clarity, realism, visual hierarchy and finishing quality of a professionally photographed and retouched campaign produced by a senior advertising art director.

This Quality Block controls visual fidelity only. It must preserve and support the selected creative concept, marketing objective, customer situation, layout, approved copy, model identity and product source of truth. Do not replace or reinterpret them.

OUTPUT QUALITY:
- Extremely clean, high-definition commercial image
- Crisp subject separation with naturally defined edges
- Fine micro-detail without artificial oversharpening
- Clear visual information at mobile-feed viewing size
- No muddy details, compression artifacts, pixelation or low-resolution texture
- Preserve detail in both highlights and shadows
- Smooth tonal gradients without color banding
- Professional color grading suitable for paid social advertising
- Visually polished to premium Canva Pro / Photoshop campaign standard
- The final image must remain sharp after platform compression and resizing

PHOTOREALISM:
- Realistic facial anatomy and recognizable human identity
- Natural pores, skin micro-texture, subtle peach fuzz and believable under-eye anatomy
- Natural skin translucency and accurate skin tone
- Individual hair strands with realistic hairline and flyaway behavior
- Accurate hands, fingers, joints and fingernails
- Believable posture, body proportions and weight distribution
- Natural facial expression appropriate to the customer situation
- Avoid generic AI influencer appearance
- Avoid plastic, waxy, porcelain or excessively whitened skin
- Do not beautify the person until their identity changes

LIGHTING:
- Physically believable professional commercial lighting
- Clear key-light direction with controlled fill and subtle separation light
- Soft but dimensional shadow transitions
- Accurate contact shadows beneath the person, product and props
- Realistic reflections, highlights and light falloff
- No random glow, fake halo, overexposure or disconnected shadows
- Lighting must match across subject, product, foreground and background
- Preserve product label readability and packaging color accuracy

CAMERA AND OPTICS:
- Use a realistic commercial camera and lens perspective appropriate to the selected composition
- Natural focal-length behavior without facial or product distortion
- Correct scale, horizon, perspective and spatial depth
- Controlled depth of field only when it improves the concept
- Keep the product, face and mandatory proof elements within the intended focus plane
- No excessive background blur that removes useful context
- No fake HDR, excessive clarity or oversharpened outlines

MATERIAL FIDELITY:
Render every material according to its real physical behavior:
- Skin must look organic and alive
- Fabric must show believable weave, folds, tension and weight
- Plastic packaging must show correct surface finish and controlled reflections
- Glass must have accurate transparency, refraction and edge highlights
- Metal must have realistic reflection and surface response
- Paper must show natural thickness, print texture and believable folds
- Liquid, cream, foam and powder must retain their correct density and texture
- Props and surfaces must not look like smooth CGI placeholders

PRODUCT SOURCE OF TRUTH:
Use the attached product image as the absolute visual source of truth.

Preserve exactly:
- packaging shape
- cap and dispenser
- label
- logo
- character or illustration
- typography printed on the package
- approved colors
- product variant
- material finish
- proportions
- visible product details

Do not redesign, simplify, stylize, relabel or redraw the product.
Do not invent unseen packaging details.
Do not replace the real packshot with an AI interpretation.

When exact packaging accuracy is required, create the scene with a clean product placement zone and composite the original transparent PNG packshot into the final artwork.

PRODUCT INTEGRATION:
- Product must appear naturally integrated into the scene
- Correct perspective relative to the camera
- Correct physical scale relative to the model and environment
- Realistic contact shadow, ambient light and reflection
- No floating product unless intentionally required by the selected concept
- Do not cover the logo, variant or essential package information
- The product must remain immediately recognizable at mobile size

GRAPHIC DESIGN FINISH:
- Strong visual hierarchy readable within approximately 2 seconds
- Headline receives first attention
- Product receives second or strategically equal attention
- Supporting benefit, proof, offer and CTA follow in a clear order
- Use intentional spacing, alignment, grid and negative space
- Add refined color gradients where appropriate
- Use professionally designed badges, price treatments, icons and graphic accents
- Use subtle dimensional shadows to separate important layers
- Typography must feel intentionally art-directed, not randomly placed
- Maintain adequate contrast and safe margins for the selected platform ratio
- Avoid crowded infographic layouts unless the selected concept specifically requires one

TEXT-SAFE PRODUCTION:
If exact Thai text, price, registration number, promotion, disclaimer or CTA is critical:
1. Generate the photographic scene without long text.
2. Preserve intentional text-safe areas.
3. Render approved text separately using HTML Canvas, SVG or professional compositing.
4. Do not ask the image model to recreate long Thai copy or legal information.

Never invent, translate, correct or paraphrase approved mandatory text without permission.

FINAL COMMERCIAL STANDARD:
The result must look like a real, professionally art-directed paid-social campaign—not a generic AI product image, ordinary packshot, stock-photo presenter, 3D showroom render or unfinished template.

NEGATIVE QUALITY CONTROL:
low resolution, soft focus, muddy details, pixelation, JPEG artifacts,
color banding, excessive sharpening, fake HDR, blown highlights,
crushed shadows, plastic skin, porcelain skin, waxy face,
generic AI influencer face, changed identity, asymmetric face,
distorted anatomy, malformed hands, extra fingers, fused fingers,
incorrect perspective, warped background, duplicated objects,
floating props, inconsistent shadows, unstable reflections,
fake materials, cheap CGI appearance, excessive glow,
altered packaging, redrawn product, wrong logo, wrong label,
incorrect product color, warped package, duplicate product,
unreadable typography, incorrect Thai text, random letters,
watermark, visual artifacts, cluttered hierarchy, weak contrast,
cropped product, covered logo, unsafe text margins`;

// Resolution table — mirrors the OpenAI Images API size strings this app
// actually requests (see components/banner-generator-client.tsx's
// aspectRatio select and app/api/tools/banner-generator/generate/route.ts's
// generateSchema.size), so COMPOSITION always states the exact pixel
// dimensions the API call will really produce — not a rounded guess.
function resolutionForSize(size?: string): string {
  if (size === '1024x1536') return '1024 x 1536 px (2:3 vertical — Story/Reels/TikTok)';
  if (size === '1536x1024') return '1536 x 1024 px (3:2 horizontal)';
  return '1024 x 1024 px (1:1 square — feed/marketplace)';
}

// Builds one named block of the THAI TEXT section. When the user supplied
// exact copy (per the "ถ้าจะก๊อปไปควรเป็น Prompt ที่สามารถสร้างงานได้จริง...
// เช่นตัวอย่างนี้" request — their example hard-codes every line of on-image
// text with its own styling note), that copy is marked "ใช้ข้อความนี้เป๊ะๆ
// ห้ามแก้คำ" so the model treats it as fixed, not a suggestion. When left
// blank, falls back to a directive telling the model to draft it — but
// still bound by [COMPLIANCE / CLAIM CONTROL] in the system prompt above,
// so an empty field never becomes a loophole to invent claims.
function textBlock(label: string, exactCopy: string | undefined, fallbackDirective: string, styleNote: string): string {
  const copyLine = exactCopy
    ? `"${exactCopy}" — ใช้ข้อความนี้เป๊ะๆ ห้ามแก้คำ`
    : `(ไม่ได้ระบุ) — ${fallbackDirective}`;
  return `${label}:\n${copyLine}\nStyle: ${styleNote}`;
}

// Phase 2: real image generation for one chosen concept (image model).
// Rewritten per explicit user request — pasted a full, production-caliber
// example prompt (ZANA Alpha Arbutin, Facebook ad) and said: "ถ้าจะก๊อปไปควร
// เป็น Prompt ที่สามารถสร้างงานได้จริง ทีละ 1 ภาพ แบบครบองค์ประกอบหลัก เช่น
// ตัวอย่างนี้" — i.e. this needs to be a complete, named-section, one-image
// brief, not the previous one-paragraph template. A later message pasted a
// second explicit block — MASTER_VISUAL_QUALITY_BLOCK above — with the
// instruction "ฉันต้องการแก้ Prompt การสร้างภาพ โดยยึด [this block]", so the
// concept-specific sections below (CORE CONCEPT / FOUNDER SOURCE OF TRUTH /
// PRODUCT FACTS / REALISTIC SCENE / FOUNDER POSE / THAI TEXT sub-blocks /
// TYPOGRAPHY / COMPOSITION / job-specific guardrails) now hand off to that
// block for everything about rendering fidelity (lighting, camera/optics,
// material fidelity, packaging-image accuracy, graphic-design finish, the
// negative list) instead of this file's own shorter, less detailed version
// of the same standards — no duplicated/conflicting instructions sent to
// the image model. Used both for the real editImages() call AND the "Copy
// Prompt to GPT" feature (same function, byte-for-byte) — so this upgrade
// improves BOTH paths. FOUNDER sections only appear when a Model Preset is
// actually attached (input.founderModel) — never fabricated when no model
// was selected, per the "no dead/fake output" principle already used
// throughout this app.
export function buildConceptImagePrompt(input: ProductInfo, concept: ConceptInput): string {
  const fm = input.founderModel;
  const sections: string[] = [];

  sections.push(`CORE CONCEPT
${concept.name}${concept.funnelStage ? ` — Funnel: ${concept.funnelStage}` : ''}
${concept.description}
Product: ${input.productName}${input.category ? ` (${input.category})` : ''}
Channel: ${input.marketplace || 'Social Commerce / Marketplace'}${
    input.adStrategy ? `\nAd visual strategy: ${input.adStrategy.name} ("${input.adStrategy.tagline}") — ${input.adStrategy.guidance}` : ''
  }`);

  if (fm) {
    sections.push(`FOUNDER — SOURCE OF TRUTH
Model: ${fm.name}
${fm.identityPrompt || 'Use the attached reference photo as the absolute identity reference — do not replace her with a generic AI-model face.'}
Preserve exactly (locked): ${fm.lockedFeatures.length ? fm.lockedFeatures.join(', ') : 'facial identity, face shape, eyes, nose, lips, skin tone, age appearance'}
May adjust for this scene (editable): ${fm.editableFeatures.length ? fm.editableFeatures.join(', ') : 'clothing, hairstyle, pose, expression, background, lighting, camera angle'}
Do not beautify or retouch her into a different-looking person. Do not smooth skin texture until identity is lost.`);
  }

  // Product FACTS only here (not packaging-image fidelity — MASTER_VISUAL_
  // QUALITY_BLOCK's own "PRODUCT SOURCE OF TRUTH" section below already
  // covers packshot/packaging/logo accuracy in more detail than this app's
  // old version did, so it isn't duplicated here).
  sections.push(`PRODUCT FACTS
${input.productName}
Confirmed selling points: ${input.sellingPoints || 'ไม่ระบุ — ห้ามแต่งสรรพคุณเพิ่มเอง'}
On-pack / required copy: ${input.onPackText || 'ไม่ระบุ'}
Age / size / quantity: ${input.ageSizeQty || 'ไม่ระบุ'}
Registration / reference info: ${input.registrationInfo || 'ไม่มีข้อมูล — ห้ามแต่งเลขขึ้นเอง'}
${input.prohibitions ? `Additional prohibitions for this job: ${input.prohibitions}` : ''}`);

  sections.push(`REALISTIC SCENE
${input.scene || `${concept.description} — เลือกฉาก/บริบทที่สมจริงและเหมาะกับ Channel และ funnel stage ข้างต้นเอง`}`);

  if (fm) {
    sections.push(`FOUNDER POSE
Natural, confident pose appropriate to "${concept.name}". Hands and body proportions must be anatomically correct — no distorted or extra fingers/limbs. Warm, trustworthy expression consistent with a real Thai brand founder, not a stiff generic stock-photo pose.`);
  }

  sections.push(`THAI TEXT
${textBlock('TOP HEADLINE', input.headline, 'เขียน headline สั้น กระแทกใจ อ่านจบใน 1-2 วินาที ต้องเชื่อมกับ Concept นี้โดยตรง', 'ตัวใหญ่สุดในภาพ น้ำหนักหนา อ่านง่ายแม้ย่อเป็น thumbnail')}

${textBlock('MAIN MESSAGE', input.mainMessage, 'สรุปประโยชน์หลักจากจุดเด่นที่ยืนยันได้เท่านั้น ห้ามแต่งสรรพคุณเพิ่ม', 'รองจาก headline ชัดเจนว่าเป็นข้อความสนับสนุน ไม่แย่งความสนใจจาก headline')}${
    fm
      ? `\n\n${textBlock('FOUNDER GUARANTEE PANEL', input.guaranteeText, `ข้อความรับรองสั้นๆ ในน้ำเสียงของ ${fm.name} เชื่อมกับความน่าเชื่อถือของแบรนด์ — ห้ามอ้างผลลัพธ์ที่ไม่มีหลักฐาน`, 'แยกเป็น panel/card ชัดเจน มีชื่อหรือลายเซ็นของผู้รับรองประกอบ')}`
      : ''
  }

${textBlock('AUTHENTICITY BADGE', input.badgeText, input.registrationInfo ? `ใช้ข้อมูลอ้างอิง "${input.registrationInfo}" ในเชิงตรวจสอบได้ ไม่แต่งความหมายเกินจริง` : 'ไม่มีข้อมูลอ้างอิงยืนยัน — ข้ามส่วนนี้หรือใช้ trust badge ทั่วไปที่ไม่อ้างเลข/ใบรับรองที่ไม่มีจริง', 'ขนาดเล็กกว่า headline วางเป็น badge/seal graphic มุมภาพ')}

${textBlock('BOTTOM CTA', input.ctaText, 'ใช้ CTA ที่ชัดเจนตาม [TEXT STANDARD] เช่น "ดูรายละเอียดในตะกร้า" หรือ "กดสั่งซื้อเลย" ให้เหมาะกับ Channel', 'วางล่างสุดของภาพ ตัดกับพื้นหลังชัดเจน กดสายตาให้เห็นง่ายที่สุด')}`);

  sections.push(`TYPOGRAPHY
ลำดับชั้นชัดเจน 4 ระดับ: Headline (ใหญ่สุด) → Main Message/Subheadline → Benefit/Supporting text → Footnote/CTA (เล็กสุด). ห้ามให้ทุกข้อความน้ำหนักเท่ากัน ต้องอ่านสแกนได้ภายใน 1-2 วินาทีบนมือถือ`);

  sections.push(`COMPOSITION
Aspect ratio: ${ratioLabelForSize(input.aspectRatio)}
Resolution: ${resolutionForSize(input.aspectRatio)}
Layout: headline ด้านบน, สินค้าเป็นจุดสนใจหลักตรงกลาง/ค่อนล่าง, badge/authenticity ไว้มุมภาพ, CTA ชิดขอบล่าง — Mobile-first โดยเฉพาะถ้าเป็น 1:1`);

  // Job-specific identity/compliance guardrails not covered by the generic
  // MASTER_VISUAL_QUALITY_BLOCK below (it's a pure visual-fidelity standard,
  // not brand/legal-claim aware) — kept short since the heavy compliance
  // rules already live in [COMPLIANCE / CLAIM CONTROL] in the system prompt
  // above, this just adds the two things unique to THIS concept/job.
  sections.push(`ADDITIONAL GUARDRAILS FOR THIS JOB
${fm ? `Founder identity must exactly match the reference photo — do not replace ${fm.name} with a different-looking person.` : 'No fabricated person/identity introduced unless part of the concept above.'}
ทุก claim/ตัวเลขที่ปรากฏในภาพ มาจากข้อมูลที่ยืนยันแล้วเท่านั้น (ดู [COMPLIANCE / CLAIM CONTROL])${input.prohibitions ? `\nJob-specific prohibitions: ${input.prohibitions}` : ''}`);

  return `${BANNER_DIRECTOR_SYSTEM_PROMPT}

สั่งสร้างภาพจริงทันที (ทำตาม [WORKFLOW] ข้อ 2 — ผู้ใช้สั่งชัดเจนแล้ว ห้ามถามซ้ำ) — Prompt สำหรับภาพนี้ภาพเดียว ครบทุกองค์ประกอบตามด้านล่าง ห้ามข้ามส่วนใดส่วนหนึ่ง:

${sections.join('\n\n────────────────────\n\n')}

────────────────────

${MASTER_VISUAL_QUALITY_BLOCK}`;
}
