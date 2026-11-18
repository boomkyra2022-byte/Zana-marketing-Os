// Content Studio prompts — per-client content for JANGZANA clients.
// One Brand Card per client feeds every call, so nobody re-types the brand
// brief per request. Approved pieces come back in as style examples
// (few-shot), which is how the output drifts toward each client's voice.

export const PROMPT_VERSION_CONTENT_STUDIO = 'content-studio-v2-2026-11-18';

export const STUDIO_FIELDS = [
  { key: 'name', label: 'ชื่อแบรนด์ / ร้าน', hint: 'เช่น ร้านจักรยานพิษณุโลก', big: false },
  { key: 'business', label: 'ธุรกิจ / สินค้าหลัก', hint: 'ขายอะไร บริการอะไร ราคาประมาณไหน', big: true },
  { key: 'audience', label: 'ลูกค้าเป้าหมาย', hint: 'อายุ เพศ ไลฟ์สไตล์ อยู่ที่ไหน', big: true },
  { key: 'pains', label: 'ปัญหา / สิ่งที่ลูกค้ากังวล', hint: 'ทำไมลูกค้าต้องการสินค้านี้', big: true },
  { key: 'usp', label: 'จุดเด่น / ทำไมต้องร้านนี้', hint: 'สิ่งที่คู่แข่งไม่มี', big: true },
  { key: 'positioning', label: 'จุดยืนคอนเทนต์ (Positioning)', hint: 'เพจนี้ "เป็นใคร" ในตลาด เช่น "พี่ช่างที่บอกความจริงเรื่องจักรยาน ไม่ขายเกินจำเป็น" — ต่างจากคู่แข่งยังไง', big: true },
  { key: 'offer', label: 'โปร / ราคาปัจจุบัน', hint: 'ใส่วันที่ด้วย — AI ใช้ราคาจากช่องนี้เท่านั้น', big: true },
  { key: 'voice', label: 'น้ำเสียงแบรนด์', hint: 'เช่น เป็นกันเอง ตลก พี่สอนน้อง หรูหรา', big: false },
  { key: 'pillars', label: 'แกนคอนเทนต์', hint: 'เช่น ความรู้, รีวิวสินค้า, เบื้องหลังร้าน, โปร', big: false },
  { key: 'cta', label: 'CTA / ช่องทางปิดการขาย', hint: 'เช่น ทักแชท, แอดไลน์, โทร, มาที่ร้าน', big: false },
  { key: 'banned', label: 'ข้อห้าม / คำห้ามใช้', hint: 'คำเคลมที่ห้ามพูด คำที่ลูกค้าไม่ชอบ', big: true },
  { key: 'examples', label: 'ตัวอย่างโพสต์ที่เคยปัง', hint: 'วางโพสต์จริงของลูกค้า 1–3 โพสต์ (AI จะเลียนสไตล์)', big: true },
  { key: 'notes', label: 'หมายเหตุอื่นๆ', hint: 'สี โลโก้ ฤดูกาล สิ่งที่ลูกค้าขอเป็นพิเศษ', big: true }
] as const;

export type StudioFieldKey = (typeof STUDIO_FIELDS)[number]['key'];

export interface StudioFormat {
  id: string;
  name: string;
  desc: string;
  group: 'post' | 'video' | 'viral' | 'tool';
  spec: string;
  single?: boolean; // one deliverable per call (lists/plans)
}

export const STUDIO_FORMATS: StudioFormat[] = [
  { id: 'sale', group: 'post', name: 'โพสต์ขาย', desc: 'Hook → ปัญหา → ทางออก → โปร → CTA',
    spec: 'โพสต์ขาย Facebook/IG: บรรทัดแรกเป็น Hook หยุดนิ้ว → ปัญหาที่ลูกค้าเจอ → สินค้าช่วยยังไง → โปร (เฉพาะที่อยู่ใน Brand Card) → CTA เดียว; ยาว 80–150 คำ; อีโมจิพอประมาณ' },
  { id: 'edu', group: 'post', name: 'คอนเทนต์ความรู้', desc: 'สอนเรื่องที่ลูกค้าอยากรู้ แล้วโยงกลับมาที่ร้าน',
    spec: 'คอนเทนต์ความรู้: Hook → 3–5 ข้อที่ใช้ได้จริง → โยงกลับมาที่ร้านแบบเนียน → CTA เบาๆ' },
  { id: 'story', group: 'post', name: 'เล่าเรื่องแบรนด์', desc: 'เบื้องหลัง เจ้าของ ความตั้งใจ (ไม่แต่งรีวิว)',
    spec: 'เล่าเรื่องแบรนด์จากข้อมูลจริงใน Brand Card เท่านั้น (เบื้องหลัง ความตั้งใจ วิธีทำงาน); ห้ามแต่งรีวิว ชื่อคน หรือเหตุการณ์ที่ไม่มีในข้อมูล' },
  { id: 'carousel', group: 'post', name: 'Carousel 5–7 สไลด์', desc: 'ข้อความบนแต่ละสไลด์ + แคปชัน',
    spec: 'Carousel 5–7 สไลด์: สไลด์ 1 = Hook ตัวใหญ่, สไลด์กลาง = 1 ประเด็นต่อสไลด์ (ไม่เกิน 20 คำ), สไลด์สุดท้าย = CTA; ตามด้วยแคปชันสั้น; เขียนเป็น "สไลด์ 1: ..." ทีละบรรทัด' },
  { id: 'reel', group: 'video', name: 'สคริปต์คลิปสั้น', desc: '30–45 วิ แยกฉาก ภาพ คำพูด ซับ',
    spec: 'สคริปต์คลิปสั้นแนวตั้ง 30–45 วินาที: แบ่งฉาก [0–3 วิ] ... แต่ละฉากมี ภาพ: / พูด: / ซับ:; 3 วิแรกต้องเป็น Hook; เปลี่ยนภาพทุก 2–4 วิ; จบด้วย CTA' },
  { id: 'myth', group: 'viral', name: 'ความเชื่อผิด vs ความจริง', desc: '"หลายคนคิดว่า… แต่จริงๆ แล้ว…"',
    spec: 'รูปแบบ Myth vs Fact: เปิดด้วยความเชื่อที่คนในกลุ่มเป้าหมายเข้าใจผิด → ความจริง (ใช้เฉพาะข้อเท็จจริงที่ตรวจได้หรืออยู่ใน Brand Card) → ทำไมสำคัญ → CTA; เขียนเป็นสคริปต์คลิปสั้นหรือโพสต์' },
  { id: 'mistake', group: 'viral', name: 'ข้อผิดพลาดที่คนส่วนใหญ่ทำ', desc: '"3 อย่างที่คุณทำผิดอยู่…"',
    spec: 'รูปแบบ Common Mistakes: "X อย่างที่คนส่วนใหญ่ทำผิดเรื่อง…" → แต่ละข้อ = ผิดยังไง + ทำที่ถูกยังไง → ข้อสุดท้ายแรงสุด → CTA' },
  { id: 'list', group: 'viral', name: 'ลิสต์ตัวเลข', desc: '"5 สิ่งที่ต้องเช็กก่อน…"',
    spec: 'รูปแบบ List: ตัวเลขชัดใน Hook ("5 สิ่งที่…") → ข้อละ 1–2 ประโยค → บอกตั้งแต่ต้นว่าข้อสุดท้ายสำคัญที่สุดเพื่อให้ดูจนจบ → CTA' },
  { id: 'vs', group: 'viral', name: 'เทียบ A vs B', desc: 'ช่วยลูกค้าตัดสินใจระหว่าง 2 ทางเลือก',
    spec: 'รูปแบบ A vs B: เทียบ 2 ทางเลือกที่ลูกค้าลังเล ด้วยเกณฑ์ 3–4 ข้อ อย่างยุติธรรม → สรุปว่าใครเหมาะกับแบบไหน → CTA ให้ทักมาถาม; ห้ามโจมตีแบรนด์คู่แข่งโดยชื่อ' },
  { id: 'pov', group: 'viral', name: 'POV สถานการณ์ลูกค้า', desc: '"POV: ตอนที่คุณ…" อินกับปัญหา',
    spec: 'รูปแบบ POV: ฉากสถานการณ์ที่ลูกค้าเจอจริงจาก Pains ใน Brand Card เล่าแบบคนที่อยู่ในเหตุการณ์ → จุดพลิกที่สินค้า/บริการช่วย → จบขำหรืออบอุ่นตาม Voice → CTA; เป็นสคริปต์คลิปสั้น' },
  { id: 'howto', group: 'viral', name: 'สอนทีละขั้น (How-to)', desc: 'ทำตามได้ทันทีภายใน 60 วิ',
    spec: 'รูปแบบ How-to: Hook บอกผลลัพธ์ → ขั้นตอน 3–5 ขั้น สั้น ทำตามได้ → เคล็ดลับปิดท้าย → CTA ให้เซฟ/แชร์ หรือทักถาม' },
  { id: 'faqclip', group: 'viral', name: 'ตอบคำถามลูกค้าเป็นคลิป', desc: 'ยกคำถามจริงมาตอบ สร้างความเชื่อ',
    spec: 'รูปแบบตอบคำถาม: เปิดด้วยคำถามที่ลูกค้าถามบ่อย (อนุมานจาก Pains/Business ห้ามแต่งชื่อคนถาม) → ตอบตรงๆ ใน 1 ประโยค → ขยายเหตุผล → CTA; เป็นสคริปต์คลิปสั้น' },
  { id: 'hooks', group: 'tool', name: 'Hook 10 แบบ', desc: 'ประโยคเปิดหยุดนิ้ว สำหรับโพสต์หรือคลิป', single: true,
    spec: 'Hook 10 แบบ ไม่ซ้ำแนว (คำถาม, ตัวเลข, ความเชื่อผิด, ก่อน-หลัง, ความลับ, เตือน, POV ฯลฯ) ใส่ใน body เป็นรายการ 1–10 พร้อมวงเล็บบอกแนว' },
  { id: 'plan7', group: 'tool', name: 'แผนคอนเทนต์ 7 วัน', desc: 'หัวข้อ รูปแบบ Funnel และ Hook รายวัน', single: true,
    spec: 'แผนคอนเทนต์ 7 วัน: แต่ละวันมี ขั้น Funnel, รูปแบบ (โพสต์/คลิป/Carousel), หัวข้อ, Hook, CTA; สัดส่วนประมาณ ทำให้รู้จัก 4 : สร้างความเชื่อ 2 : ปิดการขาย 1; ใส่ใน body เป็น วันที่ 1–7' },
  { id: 'img', group: 'tool', name: 'Prompt ภาพโฆษณา', desc: 'สำหรับ gpt-image แนวตั้ง 4:5 หรือ 9:16',
    spec: 'Prompt ภาพภาษาอังกฤษสำหรับ gpt-image: subject, ฉาก, แสง, มุมกล้อง, อารมณ์, โทนสี, ขนาด (4:5 หรือ 9:16), "no text, no logo" แล้วตามด้วยบรรทัด "ข้อความบนภาพ (ใส่เองทีหลัง):" ภาษาไทยสั้นๆ; ห้ามสร้างภาพผลิตภัณฑ์ปลอม ให้เว้นพื้นที่วางภาพสินค้าจริง' },
  { id: 'reply', group: 'tool', name: 'ตอบคอมเมนต์ / แชท', desc: 'สคริปต์ตอบคำถามที่เจอบ่อย',
    spec: 'สคริปต์ตอบคอมเมนต์/แชท: แต่ละชิ้น = คำถามที่ลูกค้าถามบ่อย 1 ข้อ (ใน title) + คำตอบ 2–4 ประโยคตามน้ำเสียงแบรนด์ (ใน body) ปิดด้วยชวนทักแชท' }
];

export const STUDIO_FORMAT_GROUPS: Record<StudioFormat['group'], string> = {
  post: 'โพสต์',
  video: 'คลิป',
  viral: 'รูปแบบไวรัล',
  tool: 'เครื่องมือ'
};

export const STUDIO_FUNNEL = [
  { id: 'tofu', name: 'ทำให้รู้จัก', desc: 'คนยังไม่รู้จักแบรนด์ — เน้นปัญหา/ความรู้/ความบันเทิง ขายน้อย',
    spec: 'ขั้น TOFU (ทำให้รู้จัก): คนดูยังไม่รู้จักแบรนด์ เน้นคุณค่า ความรู้ หรือความอิน พูดถึงสินค้าเบาๆ ได้แค่ช่วงท้าย CTA ให้ติดตาม/เซฟ/คอมเมนต์ ไม่ใช่ซื้อ' },
  { id: 'mofu', name: 'สร้างความเชื่อ', desc: 'คนเริ่มสนใจ — เทียบ พิสูจน์ ตอบข้อกังวล',
    spec: 'ขั้น MOFU (สร้างความเชื่อ): คนดูรู้จักแล้วแต่ยังลังเล ตอบข้อกังวล เทียบทางเลือก แสดงวิธีทำงานหรือหลักฐานที่มีจริงใน Brand Card CTA ให้ทักมาถาม' },
  { id: 'bofu', name: 'ปิดการขาย', desc: 'คนพร้อมซื้อ — โปร เหตุผลที่ต้องซื้อตอนนี้ CTA ชัด',
    spec: 'ขั้น BOFU (ปิดการขาย): คนดูพร้อมซื้อ บอกข้อเสนอจากช่องโปรเท่านั้น เหตุผลที่ควรตัดสินใจตอนนี้ (ถ้าโปรมีวันหมดเขตจริง) วิธีสั่ง CTA ชัด 1 อย่าง' }
] as const;

export type StudioFunnel = (typeof STUDIO_FUNNEL)[number]['id'];

// Retention checklist — every generated piece is self-scored against these,
// so weak hooks/endings are visible before anything is saved.
export const RETENTION_CHECKS = [
  'Hook ใน 3 วิแรก / บรรทัดแรก',
  'เปิดปมให้อยากรู้ต่อ',
  'ตรงจุดยืนแบรนด์',
  'กระชับ มีจังหวะ ไม่ยืด',
  'จบด้วยสิ่งที่สัญญาไว้',
  'CTA เดียว ตรงขั้น Funnel'
];

export interface StudioClientCard {
  [k: string]: unknown;
}

export interface StyleExample {
  title: string;
  body: string;
}

function brandCard(c: StudioClientCard): string {
  return STUDIO_FIELDS.filter((f) => typeof c[f.key] === 'string' && String(c[f.key]).trim())
    .map((f) => `${f.label}: ${String(c[f.key]).trim()}`)
    .join('\n');
}

export function buildContentStudioPrompt(opts: {
  client: StudioClientCard;
  formatId: string;
  funnel: string;
  topic: string;
  count: number;
  examples: StyleExample[];
}): { system: string; user: string; count: number } {
  const fmt = STUDIO_FORMATS.find((f) => f.id === opts.formatId) ?? STUDIO_FORMATS[0];
  const funnel = STUDIO_FUNNEL.find((f) => f.id === opts.funnel) ?? STUDIO_FUNNEL[0];
  const count = fmt.single ? 1 : Math.max(1, Math.min(5, opts.count));

  const system = [
    'คุณคือคนเขียนคอนเทนต์ภาษาไทยของทีม JANGZANA เขียนให้เพจของลูกค้า ด้วยน้ำเสียงของแบรนด์ลูกค้า (ไม่ใช่ของ JANGZANA)',
    'เริ่มจากจุดยืนคอนเทนต์ของแบรนด์เสมอ: ทุกชิ้นต้องตอกย้ำว่าเพจนี้ "เป็นใคร" ในตลาด',
    'กฎ: ใช้ข้อเท็จจริงจาก Brand Card เท่านั้น; ราคา/โปรใช้ได้เฉพาะที่อยู่ในช่องโปร ถ้าไม่มีห้ามใส่ราคา; ห้ามคำเคลมเกินจริง (การันตี, 100%, หายขาด, ดีที่สุด, เห็นผลทันที) โดยเฉพาะสินค้าสุขภาพ ความงาม อาหาร; ห้ามแต่งรีวิว ชื่อลูกค้า หรือตัวเลขที่ไม่มีในข้อมูล; เคารพข้อห้ามใน Brand Card; ภาษาไทยธรรมชาติแบบคนพิมพ์จริง',
    `หลังเขียนแต่ละชิ้น ให้ตรวจด้วยเช็กลิสต์ดึงคนดูจนจบ ${RETENTION_CHECKS.length} ข้อ: ${RETENTION_CHECKS.map((c, i) => `${i + 1}) ${c}`).join(' ')} — ให้คะแนนรวม 0–10 ตามจริง และถ้าข้อไหนไม่ผ่าน ใส่วิธีแก้สั้นๆ`,
    'ตอบเป็น JSON object เท่านั้น ในรูปแบบ: {"items":[{"title":"ชื่อสั้นๆ ของชิ้นนี้","body":"ข้อความพร้อมใช้","retention":{"score":8,"checks":[{"name":"Hook ใน 3 วิแรก / บรรทัดแรก","pass":true,"fix":""}]}}]}'
  ].join('\n\n');

  const user = [
    '<brand_card>\n' + brandCard(opts.client) + '\n</brand_card>',
    opts.examples.length
      ? '<style_examples> (งานที่ลูกค้าอนุมัติแล้ว: เลียนน้ำเสียง ความยาว จังหวะ ห้ามลอกเนื้อหา)\n' +
        opts.examples.map((x, i) => `--- ตัวอย่าง ${i + 1}: ${x.title}\n${x.body}`).join('\n') +
        '\n</style_examples>'
      : '',
    '<instructions>',
    'รูปแบบ: ' + fmt.spec,
    'ขั้น Funnel: ' + funnel.spec,
    'หัวข้อวันนี้: ' + (opts.topic.trim() || 'เลือกเองจากแกนคอนเทนต์ที่เหมาะกับจุดยืนและขั้น Funnel นี้'),
    `จำนวน: ${count} ชิ้น แต่ละชิ้นต่างมุมกัน`,
    '</instructions>'
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user, count };
}

export function buildAutofillPrompt(raw: string): { system: string; user: string } {
  const keys = STUDIO_FIELDS.map((f) => f.key);
  return {
    system:
      'แยกข้อมูลลูกค้าใส่ Brand Card ภาษาไทย ตอบเป็น JSON object เดียวที่มี key: ' +
      keys.join(', ') +
      ' (ทุกค่าเป็น string; ไม่มีข้อมูลให้เป็น ""; ห้ามแต่งข้อมูลหรือราคาที่ไม่มีในต้นฉบับ; examples = ข้อความโพสต์จริงที่อยู่ในต้นฉบับเท่านั้น; positioning = สรุปจุดยืนเฉพาะเมื่อต้นฉบับบอกชัด ไม่งั้นเว้นว่าง)',
    user: '<data>\n' + raw.slice(0, 20000) + '\n</data>'
  };
}
