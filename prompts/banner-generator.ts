// Prompt templates for the Banner/Ads Image Generator tool — ported
// verbatim (rules translated 1:1, not rewritten) from the team's own
// "ZANA Creative Team Prompt Library" Google Doc, section A
// (สร้างภาพโฆษณา / Image Generator), items 1–6. Explicit user request: "เป็น
// งานที่ให้ค่าย OpenAi ทำ แนวภาพชุดแบบนี้... ตาม Prompt ต้นแบบนี้" + doc link.
// Reusing the team's already-approved rules instead of inventing new ones —
// these have real production mileage behind them (anti-hallucination
// clauses on price/claims, "never redesign the package" rule, etc.).
//
// Doc source: https://docs.google.com/document/d/1MQfGgWw7kgoChqBiWHZ07D-ZCRdoBwLnEe5oA4aOFIA
// (only section A was ported — the other sections, B–J, cover captions,
// video ideas, ad copy etc., not image generation, and are out of scope for
// this tool.)

export type BannerTemplate = 'product_ad' | 'awareness' | 'conversion' | 'ecommerce' | 'social_proof' | 'theme';

export const BANNER_TEMPLATES: { value: BannerTemplate; label: string; needsReviewShot?: boolean; needsTheme?: boolean }[] = [
  { value: 'product_ad', label: 'ภาพโฆษณาจากสินค้าจริง (Product Ad)' },
  { value: 'awareness', label: 'Awareness — หยุดสายตา ให้คนรู้จักสินค้า' },
  { value: 'conversion', label: 'Conversion — เน้นขาย/ปิดการขาย' },
  { value: 'ecommerce', label: 'E-commerce — ภาพตะกร้า TikTok/Shopee' },
  { value: 'social_proof', label: 'Social Proof — รีวิวจริง', needsReviewShot: true },
  { value: 'theme', label: 'Theme / เทศกาล', needsTheme: true }
];

export interface BannerPromptInput {
  productName: string;
  priceOrPromo?: string; // left undefined → prompt explicitly forbids inventing one
  theme?: string; // required for 'theme' template
  hasReviewShot?: boolean; // true when a review screenshot was attached (social_proof)
  extraNotes?: string; // free-text the user can add on top of the template
  hasStyleReference?: boolean; // true when a separate "match this quality/layout" example image was attached
}

// Added after real user feedback comparing output against an actual
// polished ZANA reference banner ("โมเดลที่สร้างภาพมันไม่สวยไม่คมเหมือน
// แบบนี้เลย") — the team's original doc prompts (items 1–6) describe
// creative STRATEGY (Visual Hook, Funnel, Pain→Benefit, etc.) but never
// specified visual PRODUCTION quality, so the model defaulted to generic
// "AI ad art" instead of the crisp, template-grade e-commerce graphic
// design (gradient backgrounds, icon badges, bold clean Thai typography,
// drop shadows, ribbon callouts) the team actually wants. This block is
// new — not in the source doc — added specifically to close that gap.
const ART_DIRECTION = `

มาตรฐานงานออกแบบ (สำคัญมาก):
- ต้องมีคุณภาพระดับกราฟิกมืออาชีพเทียบเท่าเทมเพลต Canva/Photoshop สำหรับแบรนด์พรีเมียม ไม่ใช่ภาพที่ดูเหมือน AI สร้างขึ้นมาลอยๆ
- ใช้พื้นหลังไล่เฉด (Gradient) หรือองค์ประกอบกราฟิกที่สะอาดตา สอดคล้องกับโทนสีแบรนด์
- ตัวอักษรหลักต้องคมชัด หนา อ่านง่าย จัดวางเป็นระเบียบ มีลำดับชั้นชัดเจน (Headline ใหญ่ รอง Subtext เล็กกว่า)
- ถ้าเหมาะกับเทมเพลต ให้ใส่องค์ประกอบกราฟิกเสริม เช่น ไอคอนวงกลม (Icon Badge), ริบบิ้น/ป้ายมุม, เงาใต้สินค้า (Drop Shadow) เพื่อความน่าเชื่อถือ
- สินค้าต้องดูคมชัด แสงสวย เหมือนถ่ายสตูดิโอมืออาชีพ ไม่เบลอ ไม่มีสิ่งแปลกปลอมบิดเบี้ยว
- ห้ามให้ภาพดูหยาบ พิกเซลแตก หรือมีตัวอักษร/ไอคอนที่บิดเบี้ยวผิดรูป`;

const SHARED_FOOTER = (input: BannerPromptInput) => `

กติกาที่ต้องทำตามเสมอ:
- ใช้สินค้าจริงจากภาพแนบเป็น Hero Product รักษารูปทรง สี ฉลาก โลโก้ ฝา ตัวอักษร และรายละเอียดแพ็กเกจให้ใกล้ต้นฉบับที่สุดทุกภาพ (ถ้าขอหลายภาพ สินค้าต้องหน้าตาเหมือนกันทุกภาพ เปลี่ยนแค่ Layout/องค์ประกอบรอบๆ)
- ห้ามออกแบบขวด/ซอง/ฉลากใหม่ ห้ามทำเป็น Packshot ธรรมดา
- ข้อความบนภาพให้น้อย อ่านง่ายบนมือถือ มีลำดับชัด ต้องเป็นภาษาไทยที่ถูกต้อง ไม่สะกดผิด
- หลีกเลี่ยงคำเคลมเกินจริงหรือข้อมูลที่ไม่มีหลักฐาน ห้ามใช้คำรับประกันผลลัพธ์
${input.priceOrPromo ? `- ราคา/โปรโมชั่นที่ต้องใช้ (ห้ามเปลี่ยนตัวเลข): ${input.priceOrPromo}` : '- ไม่ใส่ราคา/โปรโมชั่น เพราะยังไม่ได้ระบุ ห้ามแต่งราคาขึ้นเอง'}
${input.extraNotes ? `- ข้อกำหนดเพิ่มเติมจากทีม: ${input.extraNotes}` : ''}
${input.hasStyleReference ? '- มีภาพตัวอย่าง "มาตรฐานความสวย/Layout ที่ต้องการ" แนบมาด้วย (ภาพสุดท้ายในชุดภาพที่แนบ) ให้เทียบระดับความสวย โทนกราฟิก และโครงสร้าง Layout จากภาพนั้น แต่ใช้สินค้าจริงจากภาพอ้างอิงสินค้า ห้ามลอกข้อความ/ราคาจากภาพตัวอย่างนั้น' : ''}${ART_DIRECTION}`;

function buildProductAd(input: BannerPromptInput): string {
  return `วิเคราะห์ภาพสินค้าที่แนบก่อน แล้วสร้างภาพโฆษณาสำหรับ ${input.productName} ให้พร้อมใช้บน Social Media

ต้องมี Visual Hook ที่หยุดสายตา และทำให้เข้าใจว่าสินค้าช่วยเรื่องอะไร
สร้างองค์ประกอบรอบสินค้าให้สัมพันธ์กับกลุ่มเป้าหมาย Pain Point และอารมณ์ของสินค้า${SHARED_FOOTER(input)}

ให้คิด Creative Brief ภายในเอง แล้วสร้างงานจริงทันที`;
}

function buildAwareness(input: BannerPromptInput): string {
  return `สร้างภาพ Awareness สำหรับ ${input.productName} โดยเป้าหมายหลักคือให้คนหยุดดู เข้าใจสินค้า และจำภาพได้

ให้เลือก Creative Device ที่เหมาะที่สุดเอง เช่น Visual Metaphor, Editorial, Meme Commerce, Lifestyle, Pattern Interrupt หรือ Sensory Visualization

โครงคิดภายใน: Attention → Problem/Desire → Product Role → Memory Hook

- สินค้าต้องเห็นชัด ไม่ขายตรงเกินไป ต้องเห็นไอเดียทันทีใน 1–2 วินาที
- ไม่ทำ Packshot พื้นหลังสวยเฉยๆ${SHARED_FOOTER(input)}`;
}

function buildConversion(input: BannerPromptInput): string {
  return `สร้างภาพโฆษณา Conversion สำหรับ ${input.productName} ให้มีโอกาสสร้างยอดขายสูง

วิเคราะห์ภายใน: Pain → Product Benefit → Proof/Reason to Believe → Offer (ถ้ามี) → CTA

- ให้สินค้าเด่น ลูกค้าต้องเข้าใจประโยชน์เร็ว มีเหตุผลให้ตัดสินใจ ไม่ใช่แค่ภาพสวย
- ถ้ามีราคา/โปรที่ระบุ ให้จัด Visual Hierarchy ให้ชัด
- CTA กระชับ${SHARED_FOOTER(input)}`;
}

function buildEcommerce(input: BannerPromptInput): string {
  return `สร้างภาพ E-commerce สำหรับ ${input.productName} ใช้ลงหน้าตะกร้าสินค้า (TikTok Shop / Shopee)

ต้องดูสะอาด อ่านง่าย และขายสินค้าได้โดยไม่เสี่ยงคำเคลม เห็นสินค้าเด่นมาก พื้นหลังสะอาด มี Key Benefit สั้นๆ ไม่ใส่ข้อมูลเยอะ${SHARED_FOOTER(input)}`;
}

function buildSocialProof(input: BannerPromptInput): string {
  return `สร้างภาพโฆษณา Social Proof สำหรับ ${input.productName} โดยใช้ Screenshot รีวิวจริงที่แนบ

- ห้ามแก้ข้อความสำคัญในรีวิว ให้รีวิวยังดูเป็น Screenshot จริง ไม่ต้องสร้างรีวิวปลอม
- ใช้สินค้าเป็น Hero ร่วมกับรีวิว สร้าง Layout ที่ทำให้คนเห็น Proof ก่อน แล้วค่อยเห็น Product
- Highlight ประโยคสำคัญได้ แต่ห้ามบิดความหมาย ไม่เพิ่มยอดรีวิว/จำนวนลูกค้า/คะแนนที่ไม่มีในภาพ
- งานต้องดูเป็น Social Commerce Creative ไม่ใช่โปสเตอร์รีวิวแข็งๆ${SHARED_FOOTER(input)}
${!input.hasReviewShot ? '\n[คำเตือน: ยังไม่ได้แนบ Screenshot รีวิวจริง — ห้ามสร้างรีวิวปลอมขึ้นมาเอง ให้เว้นพื้นที่ไว้หรือแจ้งว่าต้องแนบรีวิวก่อน]' : ''}`;
}

function buildTheme(input: BannerPromptInput): string {
  const theme = input.theme?.trim() || 'ธีมทั่วไปที่เหมาะกับแบรนด์';
  return `สร้างภาพโฆษณา ${input.productName} ในธีม ${theme}

อย่าเพียงเปลี่ยนพื้นหลังเป็นธีมเทศกาล ให้เชื่อม Theme กับพฤติกรรมหรืออารมณ์ของกลุ่มเป้าหมายจริง

คิดภายใน: Theme → Customer Moment → Emotional Trigger → Product Role → Visual Story

- สินค้าเด่น Mood & Tone สอดคล้องกับแบรนด์ มี Story หรือสถานการณ์ ข้อความสั้น
- ไม่ใช้ Symbol/องค์ประกอบจนกลบสินค้า${SHARED_FOOTER(input)}`;
}

const BUILDERS: Record<BannerTemplate, (input: BannerPromptInput) => string> = {
  product_ad: buildProductAd,
  awareness: buildAwareness,
  conversion: buildConversion,
  ecommerce: buildEcommerce,
  social_proof: buildSocialProof,
  theme: buildTheme
};

export function buildBannerPrompt(template: BannerTemplate, input: BannerPromptInput): string {
  return BUILDERS[template](input);
}
