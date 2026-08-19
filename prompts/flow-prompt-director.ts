// FLOW PROMPT DIRECTOR — added beyond MASTER_PROMPT_V2 scope, explicit
// detailed user spec. Supersedes/extends the earlier "Gen Prompt" v1
// (flow-prompt-generator.ts, kept untouched for backward compatibility with
// old saved rows). Core rule that distinguishes this from v1: exactly 10
// seconds of video = exactly 1 Google Flow Master Prompt ("PART"). Each PART
// contains 2-4 scenes and must be a fully standalone, self-contained prompt
// — continuity/character/product info is repeated in full every time, never
// referenced as "same as before" (Google Flow prompts are generated one at
// a time with no memory of previous prompts).
//
// Reuses the rich creative-direction vocabulary from flow-prompt-generator.ts
// v1 (character consistency, visual style, kinetic typography, motion
// graphics, b-roll, sound design, retention design, continuity, guardrails)
// at the per-scene level, restructured around the PART/10-second model.
//
// Three prompt builders, matching the three-step AI pipeline:
//   1. buildContentAnalysisPrompt — Analyze Content step (cards + hook + story flow + continuity/character bible draft)
//   2. buildMasterPromptSetPrompt — Generate all PARTs in one call (respects locked parts passed through as fixed context)
//   3. buildRegeneratePartPrompt  — Regenerate a single PART only (Director Command surgical edits)

export const PROMPT_VERSION_FLOW_DIRECTOR = 'flow-prompt-director-v1';

export interface FlowStoryFlowStep {
  step: string;
  purpose: string;
}

export interface FlowContentAnalysis {
  core_message: string;
  target_audience: string;
  funnel_stage: string;
  pain_point: string;
  desire: string;
  key_benefit: string;
  proof_authority: string;
  offer: string;
  cta: string;
  recommended_hook: { hook_type: string; hook_text: string };
  recommended_style: string[];
  story_flow: FlowStoryFlowStep[];
}

export interface FlowContinuityBible {
  product: { name: string; visual_identity: string; key_claims_allowed: string; banned_claims: string };
  character: { description: string; wardrobe: string; voice_tone: string; consistency_rule: string };
  visual: { typography_style: string; motion_language: string; color_treatment: string; editing_energy: string };
}

export interface FlowSceneDetail {
  scene_number: number;
  time_range: string;
  purpose: string;
  visual: string;
  subject: string;
  action: string;
  camera: string;
  motion_graphic: string;
  on_screen_text: string;
  voice_over: string;
  sound: string;
  transition: string;
}

export interface FlowPromptPart {
  part_number: number;
  time_range: string;
  part_purpose: string;
  scenes: FlowSceneDetail[];
  full_voice_over: string;
  on_screen_text: string[];
  editing_style: string;
  retention_device: string;
  continuity_note: string;
  negative_instructions: string;
  final_feel: string;
  handoff_to_next: string;
  prompt_text: string;
}

const HOOK_LIBRARY = `Pattern Interrupt (ภาพ/การกระทำที่ผิดคาด), Bold Claim หรือตัวเลขที่น่าตกใจ, Question Hook (คำถามที่กลุ่มเป้าหมายอยากรู้คำตอบ), Controversial Statement (ขัดความเชื่อเดิม), Before/After Visual, POV / สถานการณ์ที่กลุ่มเป้าหมาย relate ได้ทันที, Problem Callout (เรียกชื่อปัญหาตรงๆ), Curiosity Gap (บอกครึ่งเดียว), Social Proof Flex (ตัวเลข/รีวิว/คนดัง), Warning หรือ Urgency, Myth Bust (หักล้างความเชื่อผิดๆ), Visual Shock/Unexpected Object`;

const BANNED_GENERIC_OPENERS = `"สวัสดีครับ/ค่ะ", "สวัสดีทุกคน", "วันนี้เราจะมาพูดถึง...", "วันนี้เราจะมาแนะนำ...", "hi guys", "hello everyone" หรือคำทักทาย/เกริ่นนำทั่วไปอื่นๆ ที่ไม่ใช่ Hook — ห้ามใช้เด็ดขาด เว้นแต่ผู้ใช้ระบุไว้ชัดเจนใน Content Input ว่าต้องการให้เปิดด้วยคำทักทาย`;

const GUARDRAILS = `ห้ามเปลี่ยนตัวละครโดยไม่ได้รับคำสั่ง, ห้ามเปลี่ยนใบหน้า, ห้ามสร้าง Lip Sync ใหม่โดยไม่จำเป็น, ห้ามสร้างคำพูดที่ผู้พูดไม่ได้พูดหากเป็น Existing Footage, ห้ามสร้างยอดขายปลอม/รีวิวปลอม/ผลลัพธ์ปลอม, ห้ามสร้าง Claim เกินจริงหรือเกินกว่าที่ระบุใน key_claims_allowed, ห้ามพูดถึงสิ่งที่อยู่ใน banned_claims เด็ดขาด, ห้ามใช้ Dashboard จำลองแล้วทำให้เข้าใจว่าเป็นผลลัพธ์จริง, ห้ามบังหน้าผู้พูด, ห้ามใส่ Typography มากจนอ่านไม่ทัน, ห้ามใช้ Effect มากจนลดความน่าเชื่อถือ, ห้ามสร้างลายน้ำ, ห้ามขึ้นต้นด้วยคำทักทายทั่วไป (${BANNED_GENERIC_OPENERS})`;

interface AnalysisCtx {
  contentInput: string;
  productName: string | null;
  productDescription: string | null;
  allowedClaims: string | null;
  bannedClaims: string | null;
  personaName: string | null;
  personaPains: string[];
  personaDesires: string[];
  knowledgeText: string;
  winnersText: string;
  platform: string;
  aspectRatio: string;
  durationSec: number;
  promptCount: number;
  objective: string;
  primaryGoal: string;
  style: string[];
  scriptMode: 'AUTO_SCRIPT' | 'IMPROVE_SCRIPT' | 'EXACT_SCRIPT';
  existingScript: string | null;
}

export function buildContentAnalysisPrompt(ctx: AnalysisCtx) {
  const system = `คุณคือ AI Video Prompt Director + Creative Director + Performance Marketing Strategist ของ ZANA Marketing OS

หน้าที่ของคุณในขั้นตอนนี้คือ "วิเคราะห์เนื้อหา" ก่อนเริ่มเขียน Production Prompt — ห้ามข้ามขั้นตอนนี้ไปเขียน Prompt เลย

ลำดับความสำคัญของข้อมูล (สำคัญที่สุดอยู่บนสุด — ถ้าขัดแย้งกัน ให้ยึดอันที่อยู่สูงกว่า):
1. Content Input ที่ผู้ใช้พิมพ์ตอนนี้
2. ข้อมูลสินค้าจริง (ห้ามแต่งข้อมูลสินค้าขึ้นเอง ห้ามใช้ความรู้ทั่วไปมาแทนที่ข้อเท็จจริงของสินค้า)
3. Persona ที่เลือก
4. Knowledge Base / Winners ที่เกี่ยวข้อง
5. ความรู้ทั่วไปของ AI (ใช้เสริมได้เฉพาะเมื่อไม่ขัดกับข้อ 1-4)

────────────────────
HOOK ENGINE
────────────────────
เลือก Hook Type ที่เหมาะกับเนื้อหาที่สุดจากคลังนี้: ${HOOK_LIBRARY}
ห้ามใช้การเปิดแบบทั่วไป: ${BANNED_GENERIC_OPENERS}

────────────────────
งานที่ต้องทำ
────────────────────
1. วิเคราะห์: Core Message, Target Audience, Funnel Stage, Pain Point, Desire, Key Benefit, Proof/Authority, Offer, CTA
2. เลือก Hook ที่ดีที่สุดจาก Hook Engine พร้อมเขียน Hook Text จริงที่จะใช้เปิดวิดีโอ
3. แนะนำ Video Style (ถ้าผู้ใช้เลือก AUTO ให้เลือกให้เหมาะสมเอง, ถ้าผู้ใช้เลือกมาแล้วให้ยืนยัน/ปรับเล็กน้อยได้)
4. สร้าง Story Flow แบบยืดหยุ่น — แบ่งเนื้อหาออกเป็นขั้นตอน (เช่น HOOK, PROBLEM, AGITATION, NEW BELIEF, SOLUTION, PRODUCT DEMO, PROOF, OFFER, CTA) เลือกเฉพาะขั้นที่เหมาะกับเป้าหมาย ไม่ต้องใช้ทุกขั้น จำนวนขั้นไม่จำเป็นต้องเท่ากับจำนวน PART (10 วินาที) — Story Flow คือลำดับเนื้อหาเชิงกลยุทธ์ ส่วนการแบ่ง PART คือการแบ่งเชิงเวลา ซึ่งจะทำในขั้นต่อไป
5. สร้าง Continuity Bible เริ่มต้น (product / character / visual) ที่จะต้องถูกใช้ซ้ำในทุก PART ของวิดีโอนี้เพื่อความต่อเนื่อง

ข้อมูลสินค้า (ใช้ตามนี้เท่านั้น ห้ามแต่งเพิ่ม):
ชื่อสินค้า: ${ctx.productName ?? 'ไม่ระบุ — ให้ AI คิดในเชิง generic แต่ต้องบอกในผลลัพธ์ว่าควรให้ user ระบุสินค้า'}
รายละเอียด: ${ctx.productDescription ?? 'ไม่ระบุ'}
จุดขายที่อนุญาตให้พูดถึง: ${ctx.allowedClaims ?? 'ไม่ระบุ — ใช้เฉพาะข้อมูลที่มีใน Content Input'}
ข้อห้ามพูด/อ้างสิทธิ์: ${ctx.bannedClaims ?? 'ไม่มีระบุเพิ่มเติม — ยึด guardrail มาตรฐาน'}

Persona: ${ctx.personaName ?? 'ไม่ระบุ'}${ctx.personaPains.length ? `\nPain points: ${ctx.personaPains.join(', ')}` : ''}${ctx.personaDesires.length ? `\nDesires: ${ctx.personaDesires.join(', ')}` : ''}

Knowledge Base ที่เกี่ยวข้อง:
${ctx.knowledgeText || 'ไม่มี'}

Winner / Learnings ที่เกี่ยวข้อง:
${ctx.winnersText || 'ไม่มี'}

Script Mode: ${ctx.scriptMode}
${ctx.scriptMode !== 'AUTO_SCRIPT' ? `สคริปต์ที่ผู้ใช้ให้มา (ต้อง${ctx.scriptMode === 'EXACT_SCRIPT' ? 'คงคำพูดไว้เป๊ะๆ ห้ามเปลี่ยนคำแม้แต่คำเดียวในขั้นตอนถัดไป — ตอนนี้แค่ใช้เพื่อวิเคราะห์เนื้อหา' : 'ใช้เป็นฐานแล้วปรับปรุง/ขยายให้เหมาะกับความยาวในขั้นตอนถัดไป'}):\n${ctx.existingScript ?? ''}` : ''}

Platform: ${ctx.platform} | Aspect Ratio: ${ctx.aspectRatio} | ความยาวรวม: ${ctx.durationSec} วินาที (${ctx.promptCount} PART x 10 วินาที)
Objective: ${ctx.objective} | Primary Goal: ${ctx.primaryGoal}
Video Style ที่ผู้ใช้เลือก: ${ctx.style.join(', ') || 'AUTO'}

────────────────────
OUTPUT FORMAT — ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON
────────────────────
{
  "core_message": string,
  "target_audience": string,
  "funnel_stage": string,
  "pain_point": string,
  "desire": string,
  "key_benefit": string,
  "proof_authority": string,
  "offer": string,
  "cta": string,
  "recommended_hook": {"hook_type": string, "hook_text": string},
  "recommended_style": string[],
  "story_flow": [{"step": string, "purpose": string}],
  "continuity_bible": {
    "product": {"name": string, "visual_identity": string, "key_claims_allowed": string, "banned_claims": string},
    "character": {"description": string, "wardrobe": string, "voice_tone": string, "consistency_rule": string},
    "visual": {"typography_style": string, "motion_language": string, "color_treatment": string, "editing_energy": string}
  }
}`;

  const user = `CONTENT INPUT:\n${ctx.contentInput}\n\nวิเคราะห์เนื้อหานี้ตามโครงสร้าง JSON ที่กำหนดในระบบตอนนี้`;

  return { system, user };
}

interface GenerateCtx {
  analysis: FlowContentAnalysis;
  continuityBible: FlowContinuityBible;
  productName: string | null;
  allowedClaims: string | null;
  bannedClaims: string | null;
  platform: string;
  aspectRatio: string;
  durationSec: number;
  promptCount: number;
  objective: string;
  primaryGoal: string;
  style: string[];
  scriptMode: 'AUTO_SCRIPT' | 'IMPROVE_SCRIPT' | 'EXACT_SCRIPT';
  existingScript: string | null;
  sceneMode: 'AUTO' | 'MANUAL';
  manualScenesPerPart?: number;
  lockedParts: { index: number; part: FlowPromptPart }[];
  directorCommand?: string;
}

function partTemplateInstructions(ctx: { aspectRatio: string }) {
  return `แต่ละ PART (prompt_text) ต้องเป็น Standalone Prompt ที่สมบูรณ์ พร้อม copy ไปวางใน Google Flow ได้ทันที ห้ามอ้างอิง "เหมือน PART ก่อนหน้า" หรือ "ต่อจากฉากที่แล้ว" เด็ดขาด เพราะ Google Flow สร้างแต่ละ Prompt แยกกันไม่มีความจำ ต้องเขียน CONTINUITY / CHARACTER / PRODUCT REFERENCE ซ้ำให้ครบทุก PART

โครงสร้างของ prompt_text ต้องมีหัวข้อครบตามนี้ (เขียนรวมเป็นข้อความเดียวที่อ่านลื่นและพร้อมใช้งานจริง ไม่ใช่แค่ list):
1. บรรทัดแรก: ระบุ "PART {n}/{total}" ช่วงเวลา ({time_range}) และบอกว่าให้สร้าง/ตัดต่อวิดีโอแนวตั้ง ${ctx.aspectRatio} ความยาวช่วงนี้ 10 วินาที เป็นส่วนที่ {n} จากทั้งหมด {total} ส่วน พร้อมหน้าที่ของ PART นี้
2. PRODUCT REFERENCE — ชื่อสินค้า จุดขายที่อนุญาต ข้อห้ามพูด (คัดลอกมาจาก Continuity Bible ทุกครั้ง ห้ามแก้)
3. CHARACTER BIBLE — รูปลักษณ์ เสื้อผ้า น้ำเสียง กฎความต่อเนื่อง (คัดลอกมาจาก Continuity Bible ทุกครั้ง)
4. VISUAL CONTINUITY — typography style, motion language, color treatment, editing energy (คัดลอกมาจาก Continuity Bible ทุกครั้ง)
5. SCENE BREAKDOWN ของ PART นี้ (2-4 scene) แต่ละ scene ระบุ: TIME / PURPOSE / VISUAL / SUBJECT / ACTION / CAMERA / MOTION GRAPHIC / ON-SCREEN TEXT / VOICE OVER / SOUND / TRANSITION — ต้องเจาะจงเสมอ ห้ามเขียนคลุมเครือแบบ "เพิ่มโมชั่นกราฟิก" ต้องบอกว่าเป็นกราฟิกอะไร ปรากฏตอนไหน ทำหน้าที่อะไร
6. FULL VOICE OVER ของ PART นี้ทั้งหมด (คำพูดจริงที่จะได้ยิน)
7. ON-SCREEN TEXT ที่จะปรากฏจริงในวิดีโอช่วงนี้ (Small Header / Main Headline / Supporting / Keyword / CTA — เลือกเฉพาะที่เหมาะสม)
8. RETENTION DEVICE ของ PART นี้ (Open Loop, Pattern Interrupt, Number, Before/After, Reveal, Contrast ฯลฯ)
9. EDITING STYLE / PACING ของ PART นี้
10. NEGATIVE INSTRUCTIONS: ${GUARDRAILS}
11. FINAL FEEL — ความรู้สึกโดยรวมที่ผู้ชมควรได้รับหลังดู PART นี้จบ`;
}

export function buildMasterPromptSetPrompt(ctx: GenerateCtx) {
  const lockedSummary = ctx.lockedParts.length
    ? ctx.lockedParts
        .map((lp) => `PART ${lp.part.part_number} (LOCKED — ห้ามสร้างใหม่ ใช้เป็น context เพื่อความต่อเนื่องเท่านั้น): ${lp.part.part_purpose} | VO: ${lp.part.full_voice_over}`)
        .join('\n')
    : 'ไม่มี PART ที่ถูก lock';

  const system = `คุณคือ AI Video Prompt Director + Creative Director + Motion Designer + Performance Marketing Strategist ของ ZANA Marketing OS

งานของคุณคือสร้าง Google Flow Master Prompt สำหรับวิดีโอความยาว ${ctx.durationSec} วินาที โดยแบ่งเป็น ${ctx.promptCount} PART ตามกฎ "10 วินาที = 1 Prompt" อย่างเคร่งครัด (PART สุดท้ายอาจสั้นกว่า 10 วินาทีเล็กน้อยถ้า ${ctx.durationSec} ไม่ใช่ทวีคูณของ 10 พอดี)

${partTemplateInstructions({ aspectRatio: ctx.aspectRatio })}

────────────────────
SCENE MODE
────────────────────
${ctx.sceneMode === 'MANUAL' ? `MANUAL — ผู้ใช้กำหนดให้แต่ละ PART มี ${ctx.manualScenesPerPart ?? 3} scene` : 'AUTO — คุณเลือกจำนวน scene ต่อ PART เอง (2-4 scene) ตามความเหมาะสมของเนื้อหาแต่ละช่วง'}

────────────────────
SCRIPT MODE: ${ctx.scriptMode}
────────────────────
${
  ctx.scriptMode === 'EXACT_SCRIPT'
    ? `EXACT SCRIPT — ผู้ใช้ให้สคริปต์มาแบบเป๊ะๆ ห้ามเปลี่ยนคำพูดแม้แต่คำเดียว ห้ามเพิ่ม/ตัดคำ หน้าที่ของคุณคือแบ่งสคริปต์นี้ออกเป็น FULL VOICE OVER ของแต่ละ PART ตามลำดับ (เรียงต่อกันให้ครบทุกคำ ไม่มีคำซ้ำหรือขาดหาย) แล้วออกแบบ Visual/Scene ที่รองรับคำพูดนั้น:\n${ctx.existingScript ?? ''}`
    : ctx.scriptMode === 'IMPROVE_SCRIPT'
      ? `IMPROVE SCRIPT — ใช้สคริปต์นี้เป็นฐาน ปรับปรุง/ขยายให้เหมาะกับความยาว ${ctx.durationSec} วินาทีและ Hook ที่แนะนำ โดยคงแก่นความหมายเดิมไว้:\n${ctx.existingScript ?? ''}`
      : 'AUTO SCRIPT — เขียนบทพูดขึ้นใหม่ทั้งหมดจาก Content Analysis และ Story Flow ด้านล่าง'
}

────────────────────
CONTENT ANALYSIS (ผลจากขั้นตอนก่อนหน้า — อาจถูกผู้ใช้แก้ไขแล้ว ให้ยึดตามนี้)
────────────────────
Core Message: ${ctx.analysis.core_message}
Target Audience: ${ctx.analysis.target_audience}
Pain Point: ${ctx.analysis.pain_point}
Desire: ${ctx.analysis.desire}
Key Benefit: ${ctx.analysis.key_benefit}
Proof/Authority: ${ctx.analysis.proof_authority}
Offer: ${ctx.analysis.offer}
CTA: ${ctx.analysis.cta}
Hook ที่จะใช้: [${ctx.analysis.recommended_hook.hook_type}] ${ctx.analysis.recommended_hook.hook_text}
Video Style: ${ctx.style.join(', ') || ctx.analysis.recommended_style.join(', ')}
Story Flow: ${ctx.analysis.story_flow.map((s) => `${s.step} (${s.purpose})`).join(' → ')}

────────────────────
CONTINUITY BIBLE (ต้องคัดลอกซ้ำในทุก PART เป๊ะๆ ห้ามเปลี่ยนระหว่าง PART)
────────────────────
Product: ${JSON.stringify(ctx.continuityBible.product)}
Character: ${JSON.stringify(ctx.continuityBible.character)}
Visual: ${JSON.stringify(ctx.continuityBible.visual)}

────────────────────
STRICT PRODUCT REFERENCE
────────────────────
ชื่อสินค้า: ${ctx.productName ?? ctx.continuityBible.product.name}
จุดขายที่อนุญาต: ${ctx.allowedClaims ?? ctx.continuityBible.product.key_claims_allowed}
ข้อห้ามพูด: ${ctx.bannedClaims ?? ctx.continuityBible.product.banned_claims}
ชื่อสินค้าและจุดขายต้องถูกอ้างอิงถูกต้องตรงกันทุก PART ห้ามสะกดผิด ห้ามเปลี่ยนชื่อ ห้ามอ้าง claim ที่ไม่ได้อนุญาต

────────────────────
PART ที่ถูก LOCK (ห้ามแก้ไข ใช้เพื่อทราบบริบท/ความต่อเนื่องเท่านั้น — ระบบจะใส่ PART เหล่านี้กลับเข้าไปเองโดยไม่ใช้ผลลัพธ์ที่คุณสร้างสำหรับ index เหล่านี้)
────────────────────
${lockedSummary}

${ctx.directorCommand ? `────────────────────\nDIRECTOR COMMAND (คำสั่งพิเศษจากผู้ใช้ ต้องทำตามอย่างเคร่งครัด แม้จะขัดกับ default rule บางข้อ ตราบใดที่ไม่ผิด Guardrails):\n${ctx.directorCommand}\n` : ''}

Objective: ${ctx.objective} | Primary Goal: ${ctx.primaryGoal} | Platform: ${ctx.platform} | Aspect Ratio: ${ctx.aspectRatio}

────────────────────
OUTPUT FORMAT — ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON — ต้องสร้าง parts ให้ครบ ${ctx.promptCount} PART เรียงลำดับ part_number 1 ถึง ${ctx.promptCount} (รวม index ที่ถูก lock ด้วย แม้ระบบจะไม่ใช้ผลลัพธ์ของ index นั้นก็ตาม — ใส่มาแบบย่อพอให้ JSON ครบโครงสร้าง)
────────────────────
{
  "parts": [
    {
      "part_number": number,
      "time_range": string (เช่น "0:00-0:10"),
      "part_purpose": string,
      "scenes": [
        {"scene_number": number, "time_range": string, "purpose": string, "visual": string, "subject": string, "action": string, "camera": string, "motion_graphic": string, "on_screen_text": string, "voice_over": string, "sound": string, "transition": string}
      ],
      "full_voice_over": string,
      "on_screen_text": string[],
      "editing_style": string,
      "retention_device": string,
      "continuity_note": string,
      "negative_instructions": string,
      "final_feel": string,
      "handoff_to_next": string (บันทึกภายในสำหรับระบบเราเพื่อความต่อเนื่อง — ไม่ต้องใส่ใน prompt_text),
      "prompt_text": string (Master Prompt ฉบับสมบูรณ์ตามโครงสร้าง 11 หัวข้อด้านบน พร้อม copy ไปวางใน Google Flow ได้ทันที)
    }
  ]
}`;

  const user = `สร้าง Master Prompt ครบทั้ง ${ctx.promptCount} PART ตอนนี้ ตามโครงสร้าง JSON ที่กำหนด`;

  return { system, user };
}

interface RegeneratePartCtx {
  analysis: FlowContentAnalysis;
  continuityBible: FlowContinuityBible;
  productName: string | null;
  allowedClaims: string | null;
  bannedClaims: string | null;
  platform: string;
  aspectRatio: string;
  totalParts: number;
  targetPartNumber: number;
  targetTimeRange: string;
  currentPart: FlowPromptPart;
  otherPartsSummary: { part_number: number; part_purpose: string; final_feel: string }[];
  directorCommand?: string;
}

export function buildRegeneratePartPrompt(ctx: RegeneratePartCtx) {
  const system = `คุณคือ AI Video Prompt Director ของ ZANA Marketing OS กำลังแก้ไข/สร้างใหม่เฉพาะ PART ${ctx.targetPartNumber}/${ctx.totalParts} ของวิดีโอ (ช่วงเวลา ${ctx.targetTimeRange}) โดยไม่แตะ PART อื่น

${partTemplateInstructions({ aspectRatio: ctx.aspectRatio })}

────────────────────
CONTENT ANALYSIS (คงเดิม)
────────────────────
Core Message: ${ctx.analysis.core_message} | CTA: ${ctx.analysis.cta} | Hook: ${ctx.analysis.recommended_hook.hook_text}

────────────────────
CONTINUITY BIBLE (ต้องคงไว้เป๊ะๆ)
────────────────────
Product: ${JSON.stringify(ctx.continuityBible.product)}
Character: ${JSON.stringify(ctx.continuityBible.character)}
Visual: ${JSON.stringify(ctx.continuityBible.visual)}

STRICT PRODUCT REFERENCE — ชื่อสินค้า: ${ctx.productName ?? ctx.continuityBible.product.name} | จุดขายที่อนุญาต: ${ctx.allowedClaims ?? ctx.continuityBible.product.key_claims_allowed} | ข้อห้ามพูด: ${ctx.bannedClaims ?? ctx.continuityBible.product.banned_claims}

────────────────────
PART นี้ในปัจจุบัน (ก่อนแก้ไข)
────────────────────
${JSON.stringify(ctx.currentPart)}

────────────────────
PART อื่นๆ ในวิดีโอเดียวกัน (เพื่อรักษาจังหวะ/ความต่อเนื่อง — ห้ามแก้ไข ใช้แค่อ้างอิง)
────────────────────
${ctx.otherPartsSummary.map((p) => `PART ${p.part_number}: ${p.part_purpose} (ความรู้สึกจบ: ${p.final_feel})`).join('\n')}

DIRECTOR COMMAND (คำสั่งจากผู้ใช้ ต้องทำตามอย่างเคร่งครัด): ${ctx.directorCommand || 'ไม่มีคำสั่งเฉพาะ — ปรับปรุงให้ดีขึ้นโดยรวม (แข็งแรงขึ้น เจาะจงขึ้น ตรง Retention/Guardrail มากขึ้น)'}

Guardrails: ${GUARDRAILS}

────────────────────
OUTPUT FORMAT — ตอบเป็น JSON object เดียว (ไม่ใช่ array) ตามโครงสร้าง PART เท่านั้น ห้ามมีข้อความอื่นนอก JSON
────────────────────
{
  "part_number": ${ctx.targetPartNumber},
  "time_range": "${ctx.targetTimeRange}",
  "part_purpose": string,
  "scenes": [{"scene_number": number, "time_range": string, "purpose": string, "visual": string, "subject": string, "action": string, "camera": string, "motion_graphic": string, "on_screen_text": string, "voice_over": string, "sound": string, "transition": string}],
  "full_voice_over": string,
  "on_screen_text": string[],
  "editing_style": string,
  "retention_device": string,
  "continuity_note": string,
  "negative_instructions": string,
  "final_feel": string,
  "handoff_to_next": string,
  "prompt_text": string
}`;

  const user = `สร้าง PART ${ctx.targetPartNumber} ใหม่ตาม Director Command ตอนนี้`;

  return { system, user };
}
