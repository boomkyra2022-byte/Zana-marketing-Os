import type { Product } from '@/types/database';

// ZANA Hook Library — "300 Hook ปิดการขาย ใช้ได้กับทุกสินค้า" (user-supplied
// document, 2026-10-02: "เพิ่มระบบคิด Hook แบบนี้เข้าไป"). 15 สาย × 20 ประโยค.
//
// Used in two places (explicit user choice "ทั้งสองที่"):
//   1. /hook-generator — standalone page (browse / search / copy / AI adapt)
//   2. AI Video Prompt Studio — "Hook" step; the chosen opening hook +
//      closing line are locked verbatim into the Master Prompt.
// And in two modes (explicit user choice "คลัง + AI ปรับตามสินค้า"):
//   - Library: the 300 lines below, verbatim from the user's document.
//   - AI adapt: buildHookAdaptMessages() uses the selected สาย's lines as
//     few-shot examples and rewrites them around a real product's facts.
//
// Static data + pure functions only — safe to import from client components
// (no server-only imports here; `Product` is a type-only import).
export const PROMPT_VERSION_HOOK_LIBRARY = 'v1';

export type HookPosition = 'opening' | 'closing' | 'both';

export interface HookCategory {
  id: string;
  label: string; // ชื่อสาย ตามเอกสารของผู้ใช้
  position: HookPosition; // opening = เปิดคลิป (0-3 วิแรก), closing = ปิดการขายท้ายคลิป
  funnel: 'Awareness' | 'Consideration' | 'Conversion';
  intent: string; // what this สาย does psychologically — fed to the AI adapt prompt
  hooks: string[];
}

export const HOOK_CATEGORIES: HookCategory[] = [
  {
    id: 'hesitate',
    label: 'ถ้ายังลังเล ให้ดูอันนี้',
    position: 'opening',
    funnel: 'Consideration',
    intent: 'Speak to a viewer who is already comparing or hesitating — lower the risk of a wrong purchase and earn the next few seconds of attention.',
    hooks: [
      'ถ้ากำลังลังเลว่าจะซื้อไหม ดูอันนี้ก่อน',
      'ยังไม่ต้องซื้อ แต่อยากให้ดูตรงนี้ก่อน',
      'ใครกำลังเทียบหลายตัว ดูข้อนี้ก่อนตัดสินใจ',
      'ถ้าคุณมีงบประมาณประมาณนี้ อันนี้น่าดูมาก',
      'ก่อนกดสั่ง อยากให้รู้เรื่องนี้ก่อน',
      'ถ้าซื้อแล้วไม่อยากเสียดายเงิน เช็กตรงนี้ก่อน',
      'อันนี้เหมาะกับคนที่ไม่อยากซื้อซ้ำบ่อย ๆ',
      'ถ้าคุณเป็นคนเลือกของนาน คลิปนี้ทำมาให้เลย',
      'ยังไม่มั่นใจใช่ไหม เดี๋ยวพาดูของจริง',
      'ใครลังเลเพราะเรื่องนี้ ฟังตรงนี้ก่อน',
      'อย่าเพิ่งกดผ่าน ถ้าคุณกำลังหาของแบบนี้',
      'ถ้าต้องเลือกแค่หนึ่งตัว เรามาดูเหตุผลกัน',
      'ของชิ้นนี้ไม่ได้เหมาะกับทุกคน แต่ถ้าคุณเป็นแบบนี้…',
      'ถ้าคุณเคยซื้อแล้วผิดหวัง อันนี้อยากให้ดู',
      'อยากซื้อแบบไม่ต้องมานั่งเสียดายทีหลัง ดูคลิปนี้',
      'ถ้าราคาคือสิ่งที่ทำให้ลังเล ลองดูสิ่งที่ได้ก่อน',
      'ก่อนจะบอกว่าแพง ลองดูว่าข้างในให้อะไรบ้าง',
      'ถ้าคุณกำลังหา “ตัวคุ้ม” อันนี้ต้องดู',
      'ไม่ต้องเชื่อเรา ดูรายละเอียดแล้วตัดสินใจเอง',
      'ถ้าคุณเลือกจากความคุ้มมากกว่าคำโฆษณา ดูอันนี้'
    ]
  },
  {
    id: 'why-people-buy',
    label: 'ทำไมคนถึงซื้อ',
    position: 'opening',
    funnel: 'Consideration',
    intent: 'Open a curiosity gap around social proof — why real buyers pick and re-buy this — without stating numbers that are not provided.',
    hooks: [
      'รู้ไหมว่าทำไมช่วงนี้คนหยิบตัวนี้กันเยอะ',
      'จุดที่ทำให้คนซื้อซ้ำ ไม่ใช่สิ่งที่คิด',
      'ตอนแรกก็ไม่เข้าใจว่าทำไมคนชอบ จนได้ลองเอง',
      'ของชิ้นนี้มีเหตุผลที่คนกลับมาซื้ออีก',
      'สิ่งที่คนซื้อจริงชอบที่สุดคือข้อนี้',
      'ถามว่าคุ้มไหม ดูจากตรงนี้ได้เลย',
      'คนที่ใช้จริงมักพูดถึงจุดนี้',
      'เหตุผลที่ตัวนี้ขายได้เรื่อย ๆ คือ…',
      'ไม่ได้ขายเพราะกระแสอย่างเดียว มันมีจุดนี้',
      'ถ้าสงสัยว่าทำไมตัวนี้ถึงมีคนซื้อ ลองดู',
      'สิ่งแรกที่คนส่วนใหญ่สังเกตหลังใช้คือ…',
      'ตัวนี้มีอะไรบางอย่างที่ทำให้คนกลับมาซื้อ',
      'ไม่แปลกใจเลยว่าทำไมคนถึงหยิบเข้าตะกร้า',
      'จุดนี้แหละที่ทำให้หลายคนเปลี่ยนใจ',
      'จากคนที่ไม่คิดจะซื้อ กลายเป็นซื้อเพราะข้อนี้',
      'ตอนแรกไม่ได้คาดหวัง แต่ผลคือ…',
      'ตัวนี้ไม่ได้เด่นแค่หน้าตา',
      'ถ้าคุณเห็นรายละเอียดนี้ คุณจะเข้าใจราคา',
      'สิ่งที่ทำให้ตัวนี้ต่างจากตัวทั่วไปคือ…',
      'คนซื้อไม่ได้มองแค่ราคาค่ะ เขามองตรงนี้ด้วย'
    ]
  },
  {
    id: 'push-decision',
    label: 'กระตุ้นให้ตัดสินใจ',
    position: 'both',
    funnel: 'Conversion',
    intent: 'Nudge a warm viewer to take the next small step (open the basket, check the price, save) without pressure.',
    hooks: [
      'ถ้าตรงกับที่กำลังหา กดดูรายละเอียดไว้ได้เลย',
      'ใครเล็งอยู่ วันนี้เป็นจังหวะที่น่ากดมาก',
      'ถ้าตัดสินใจได้แล้ว อย่าลืมเช็กราคาในตะกร้า',
      'ตัวนี้ถ้าจะเอา แนะนำเช็กโปรก่อน',
      'ก่อนหมดโปร เข้าไปดูราคาก่อนได้เลย',
      'ถ้าราคาโอเคสำหรับคุณ กดเก็บไว้ก่อนก็ได้',
      'ใครกำลังจะซื้อของประเภทนี้ ลองเปิดดูตัวนี้ก่อน',
      'ไม่ต้องรีบเชื่อเรา เปิดดูรายละเอียดเองได้เลย',
      'ถ้าชอบแบบนี้ กดเข้าตะกร้าไว้ก่อน',
      'ราคานี้ถ้าหมดโปรอาจไม่เท่าเดิมนะ',
      'ใครรออยู่ ลองเช็กราคา ณ ตอนนี้ก่อน',
      'ถ้ากำลังหาอยู่พอดี ตัวนี้ไม่ต้องเลื่อนผ่าน',
      'เจอแล้วก็เซฟไว้ เผื่อกลับมาซื้อทีหลัง',
      'ถ้าคุณกำลังตัดสินใจอยู่ ดูรีวิวนี้ให้จบก่อน',
      'ชอบค่อยซื้อ ไม่ชอบก็ผ่านได้เลย',
      'แต่ถ้าตรงกับชีวิตคุณ อันนี้กดไว้ได้เลย',
      'ใครดูจบแล้วรู้สึกว่าใช่ เช็กในตะกร้าได้เลย',
      'ถ้าอยากลอง แนะนำเริ่มจากตัวนี้',
      'กำลังหาของแบบนี้อยู่ใช่ไหม ตัวเลือกนี้น่าสนใจ',
      'ไม่ต้องคิดเยอะ ถ้าคุณกำลังหาสิ่งนี้อยู่พอดี'
    ]
  },
  {
    id: 'problem-solution',
    label: 'ปัญหา → ทางออก',
    position: 'opening',
    funnel: 'Awareness',
    intent: 'Name a concrete everyday problem the viewer recognises in themselves, then promise an easier way.',
    hooks: [
      'ถ้าคุณเจอปัญหานี้ทุกวัน ลองดูตัวนี้',
      'ใครเบื่อปัญหาเดิม ๆ ลองเปลี่ยนวิธีดู',
      'ปัญหานี้แก้ได้ง่ายกว่าที่คิด',
      'ถ้าเจอปัญหานี้บ่อย อันนี้อาจช่วยได้',
      'ใครกำลังเสียเวลาเพราะเรื่องนี้ ดูอันนี้',
      'เคยหงุดหงิดกับเรื่องนี้ไหม?',
      'ถ้าคุณกำลังเจอปัญหานี้ อย่าเพิ่งเลื่อน',
      'สิ่งนี้ช่วยลดขั้นตอนที่น่ารำคาญไปได้เยอะ',
      'ถ้าทำแบบเดิมแล้วไม่เวิร์ก ลองดูทางเลือกนี้',
      'ใครไม่ชอบความยุ่งยาก น่าจะชอบตัวนี้',
      'ปัญหาเล็ก ๆ ที่สร้างความรำคาญทุกวัน แก้ตรงนี้ได้',
      'ถ้าเรื่องนี้ทำให้เสียเวลา ลองดูตัวช่วยนี้',
      'ใครเจอปัญหานี้เหมือนกัน มาทางนี้',
      'ไม่ต้องทนกับปัญหาเดิมทุกวันก็ได้',
      'ถ้าคุณเคยเจอแบบนี้ จะเข้าใจว่าทำไมเราถึงหยิบตัวนี้',
      'ตัวช่วยเล็ก ๆ ที่ทำให้เรื่องเดิมง่ายขึ้น',
      'จากที่เคยยุ่งยาก กลายเป็นง่ายขึ้นเพราะสิ่งนี้',
      'ถ้าคุณอยากลดขั้นตอน อันนี้ตอบโจทย์',
      'ใครกำลังหาวิธีแก้ปัญหานี้ ดูจนจบ',
      'ถ้าปัญหานี้เกิดกับคุณบ่อย ตัวนี้ควรอยู่ในลิสต์'
    ]
  },
  {
    id: 'value-money',
    label: 'คุ้ม / เงิน',
    position: 'opening',
    funnel: 'Consideration',
    intent: 'Reframe price as value — what the money actually buys, cost per use, paying once — never by inventing a price or discount.',
    hooks: [
      'เงินเท่านี้ ได้อะไรกลับมาบ้าง มาดูกัน',
      'ก่อนจ่ายเงิน เรามาดูว่าคุ้มตรงไหน',
      'ราคานี้ไม่ได้ดูแค่ตัวเลข ต้องดูสิ่งที่ได้ด้วย',
      'ถ้าจะซื้อทั้งที ขอเลือกแบบที่ใช้จริง',
      'ซื้อของถูกไม่ได้แปลว่าคุ้มเสมอไป',
      'ความคุ้มของตัวนี้อยู่ตรงนี้',
      'ถ้าคุณมีงบจำกัด ดูตัวนี้ก่อน',
      'งบประมาณนี้ อยากได้อะไรบ้าง?',
      'ถ้าต้องจ่ายเงิน เราขอเลือกแบบนี้',
      'ราคาอาจเป็นเรื่องแรกที่เห็น แต่ไม่ใช่เรื่องเดียว',
      'ตัวนี้เหมาะกับคนที่อยากจ่ายครั้งเดียวแล้วจบ',
      'ซื้อทั้งที เอาที่ใช้ได้จริงดีกว่า',
      'ถ้าคิดเรื่องต้นทุนระยะยาว อันนี้น่าสนใจ',
      'ลองหารเฉลี่ยต่อการใช้งาน แล้วจะเห็นความต่าง',
      'ของบางอย่างถูกตอนซื้อ แต่แพงตอนใช้งาน',
      'ตัวนี้คือแนวคิด “จ่ายเพื่อความสะดวก”',
      'ถ้าคุณซื้อเพราะความคุ้ม ต้องดูข้อนี้',
      'เงินจำนวนนี้แลกกับอะไรได้บ้าง?',
      'ไม่ได้บอกว่าถูกที่สุด แต่ดูสิ่งที่ได้ก่อน',
      'ถ้าคุณกำลังหาของที่ “ราคาไม่แรงแต่ใช้งานได้จริง” ดูตัวนี้'
    ]
  },
  {
    id: 'real-review',
    label: 'รีวิวแบบคนใช้จริง',
    position: 'opening',
    funnel: 'Consideration',
    intent: 'Sound like an honest real user — admits limits as well as strengths — to build trust before the pitch.',
    hooks: [
      'ใช้เองแล้วอยากเล่าให้ฟังตรง ๆ',
      'ไม่พูดข้อดีอย่างเดียว ข้อจำกัดก็จะบอก',
      'อันนี้คือสิ่งที่รู้สึกหลังใช้จริง',
      'ถ้าให้คะแนนจากการใช้งานจริง เราจะดูจากอะไร?',
      'ใช้มาสักพักแล้ว ถึงกล้าพูดแบบนี้',
      'หลังจากใช้จริง สิ่งที่ชอบที่สุดคือ…',
      'จุดที่ประทับใจเกินคาดคือ…',
      'จุดที่คิดว่าควรรู้ก่อนซื้อคือ…',
      'ถ้าย้อนกลับไปก่อนซื้อ เราอยากรู้ข้อนี้มาก',
      'ถ้าเพื่อนถามว่าซื้อไหม เราจะตอบแบบนี้',
      'หลังใช้จริง มีเรื่องหนึ่งที่อยากเตือน',
      'ของจริงกับที่คิดไว้ ต่างกันตรงไหน?',
      'เปิดให้ดูแบบไม่แต่งเรื่อง',
      'มาดูกันว่าของจริงเป็นยังไง',
      'ถ้าคุณไม่ชอบรีวิวเวอร์ ๆ ดูอันนี้',
      'ขอรีวิวแบบคนซื้อเอง ไม่อวยเกินจริง',
      'นี่คือสิ่งที่ได้หลังจากลองใช้',
      'ใช้จริงแล้วถึงเข้าใจว่าทำไมเขาทำแบบนี้',
      'ถ้าจะซื้อ เราอยากให้ดูตรงนี้ก่อน',
      'รีวิวแบบสั้น ๆ แต่เอาไปตัดสินใจได้'
    ]
  },
  {
    id: 'compare',
    label: 'เปรียบเทียบ',
    position: 'opening',
    funnel: 'Consideration',
    intent: 'Promise a clear, visible comparison that helps the viewer choose by use case — never name or disparage a competitor brand.',
    hooks: [
      'ต่างกันตรงไหน เดี๋ยวเทียบให้ดู',
      'ตัวธรรมดากับตัวนี้ ต่างกันแค่ไหน?',
      'ก่อนเลือก ลองดูสองแบบนี้พร้อมกัน',
      'ถ้าต้องเลือกระหว่างสองตัว ดูข้อนี้',
      'ราคาแตกต่าง แต่สิ่งที่ได้ต่างกันไหม?',
      'ของคล้ายกัน แต่ใช้งานไม่เหมือนกัน',
      'ใครกำลังเทียบราคา คลิปนี้ช่วยได้',
      'อย่าดูแค่ราคาป้าย ลองดูรายละเอียด',
      'ตัวไหนเหมาะกับใคร มาดูแบบไม่อ้อม',
      'ถ้าคุณชอบแบบ A แต่ลังเลแบบ B ดูอันนี้',
      'จุดต่างที่คนมักมองข้ามคือ…',
      'สองตัวนี้หน้าตาคล้าย แต่มีเรื่องหนึ่งต่างกัน',
      'ถ้าให้เลือกตามการใช้งาน ต้องดูตรงนี้',
      'อย่าซื้อเพราะถูกกว่าอย่างเดียว',
      'ความต่างไม่ได้อยู่ที่ราคา',
      'ถ้าคุณกำลังเปรียบเทียบอยู่ ดูให้จบ',
      'ตัวไหนคุ้มกว่าสำหรับการใช้งานแบบไหน?',
      'มาดูข้อแตกต่างที่เห็นด้วยตา',
      'ใครกำลังตัดสินใจระหว่างสองแบบ เซฟคลิปนี้',
      'เลือกผิดอาจไม่ใช่เพราะของไม่ดี แต่อาจเพราะเลือกไม่ตรงการใช้งาน'
    ]
  },
  {
    id: 'soft-fomo',
    label: 'FOMO แบบไม่กดดัน',
    position: 'both',
    funnel: 'Conversion',
    intent: 'Create gentle urgency around checking the current price / promo / coupon — never state a specific price, discount or deadline that was not provided.',
    hooks: [
      'ใครกำลังเล็งอยู่ เช็กราคาก่อนนะ',
      'โปรที่เห็นตอนนี้ ลองเข้าไปเช็กอีกที',
      'ราคาขึ้นลงตามช่วง ใครสนใจลองดูตอนนี้',
      'ถ้ารออยู่ ลองเช็กก่อนว่าราคายังเท่าเดิมไหม',
      'ของที่กำลังดูอยู่ ถ้าตรงนี้ใช่ กดไว้ก่อนก็ได้',
      'ใครเคยถามราคา ตอนนี้เข้าไปดูได้เลย',
      'ถ้ากำลังรอจังหวะซื้อ ลองเช็กโปรวันนี้',
      'ตัวนี้ช่วงโปรน่าสนใจกว่าปกติ',
      'ใครมีแพลนจะซื้ออยู่แล้ว เช็กราคาก่อนจ่าย',
      'ถ้าราคานี้โอเคสำหรับคุณ อย่าลืมกดใช้ส่วนลด',
      'ใครมีโค้ดอยู่ อย่าลืมใช้ก่อนชำระ',
      'ก่อนกดจ่าย เช็กคูปองตรงนี้ด้วย',
      'บางทีส่วนลดอยู่ตรงที่เราไม่ทันสังเกต',
      'อย่าเพิ่งจ่ายเต็ม ถ้ายังไม่ได้เช็กโปร',
      'ถ้ามีคูปอง กดใช้ก่อนนะ',
      'ราคาเดียวกัน แต่ช่วงโปรอาจต่างกัน',
      'ถ้าจะซื้ออยู่แล้ว ลองเช็กโปรก่อน',
      'ของที่ตั้งใจซื้อ ลองดูว่ามีโปรอะไรบ้าง',
      'อย่าลืมเช็กสิทธิ์ก่อนกดสั่ง',
      'ซื้อช่วงไหนคุ้มกว่า ดูตรงนี้ได้เลย'
    ]
  },
  {
    id: 'unplanned-want',
    label: 'อยากได้โดยไม่รู้ตัว',
    position: 'opening',
    funnel: 'Awareness',
    intent: 'Trigger latent desire in a cold viewer — "I did not plan to want this" — through an honest first-person turn.',
    hooks: [
      'ตอนแรกไม่ได้อยากได้ แต่พอเห็นแบบนี้…',
      'ไม่คิดว่าจะต้องมี จนมาเจอสิ่งนี้',
      'ของที่ไม่ได้อยู่ในลิสต์ แต่ตอนนี้อยากได้',
      'ใครไม่เคยคิดจะซื้อ ลองดูมุมนี้',
      'สิ่งนี้ทำให้คำว่า “เออ มีก็ดี” เกิดขึ้นจริง',
      'ของที่ดูเหมือนไม่จำเป็น จนได้ลองใช้',
      'ตอนแรกคิดว่าเฉย ๆ สุดท้ายหยิบใช้ทุกวัน',
      'ไม่ได้ตั้งใจซื้อ แต่ตอนนี้ไม่อยากขาด',
      'ใครชอบของที่ทำให้ชีวิตง่ายขึ้น น่าจะเข้าใจ',
      'ของชิ้นเดียวที่ทำให้หลายอย่างสะดวกขึ้น',
      'ถ้ามีแล้วชีวิตง่ายขึ้น คุณจะซื้อไหม?',
      'ของแบบนี้มีไว้แล้วไม่เสียหาย',
      'เห็นครั้งแรกอาจเฉย ๆ แต่ลองดูตอนใช้งาน',
      'ความน่าใช้ของตัวนี้อยู่ตรงนี้',
      'บางอย่างไม่รู้ว่าต้องมี จนได้ใช้',
      'ถ้าคุณชอบของที่ “มีไว้แล้วได้ใช้” ดูอันนี้',
      'นี่แหละของที่ซื้อแล้วไม่ได้วางทิ้ง',
      'ถ้าชอบของใช้งานจริง น่าจะถูกใจ',
      'ของชิ้นนี้มีเหตุผลให้หยิบใช้บ่อย',
      'จาก “ไม่จำเป็น” กลายเป็น “ขาดไม่ได้” ได้ยังไง?'
    ]
  },
  {
    id: 'end-cta',
    label: 'ปิดการขายท้ายคลิป',
    position: 'closing',
    funnel: 'Conversion',
    intent: 'A clear final call to action pointing at the basket / link — one action, no pressure.',
    hooks: [
      'ถ้าตรงกับที่กำลังหา กดดูในตะกร้าได้เลย',
      'รายละเอียดอยู่ตรงตะกร้า ใครสนใจกดดูได้',
      'ใครอยากลอง เดี๋ยวแปะไว้ให้แล้ว',
      'กดดูราคาได้เลยนะคะ ราคาปัจจุบันอยู่ในตะกร้า',
      'ใครสนใจตัวนี้ กดเข้าดูรายละเอียดได้เลย',
      'ชอบแบบไหน เลือกในตะกร้าได้เลย',
      'กดเข้าไปดูตัวเลือกก่อน แล้วค่อยตัดสินใจก็ได้',
      'ใครกำลังหาอยู่ กดเซฟไว้ก่อนได้',
      'อยากรู้ราคา ณ ตอนนี้ กดดูตรงนี้เลย',
      'รายละเอียดทั้งหมดเราแปะไว้ให้แล้ว',
      'ถ้าตรงกับความต้องการ กดสั่งได้เลย',
      'ใครพร้อมแล้ว ไปดูในตะกร้าได้เลย',
      'กดเข้าไปดูโปรก่อนนะ',
      'ถ้าสนใจ ลองกดดูรีวิวเพิ่มเติมได้',
      'ตัวเลือกและรายละเอียดอยู่ในลิงก์แล้ว',
      'ใครอยากได้ กดไว้ก่อน เดี๋ยวค่อยตัดสินใจ',
      'ไม่ต้องถามราคา กดดูได้เลยค่ะ',
      'อยากลองก็จัดได้เลย ตัวนี้มีให้เลือกหลายแบบ',
      'ใครเล็งอยู่ กดเข้าไปดูได้เลย',
      'ถ้าใช่สำหรับคุณ เจอกันในตะกร้านะ'
    ]
  },
  {
    id: 'confidence',
    label: 'สร้างความมั่นใจ',
    position: 'opening',
    funnel: 'Consideration',
    intent: 'Remove fear of buying online / choosing wrong — a quick checklist framing that makes the viewer feel guided.',
    hooks: [
      'ซื้อของออนไลน์ สิ่งแรกที่ควรเช็กคือข้อนี้',
      'ก่อนสั่ง อยากให้ดูรายละเอียดนี้',
      'ถ้ากลัวซื้อมาแล้วไม่ตรงปก ดูตรงนี้',
      'ใครกลัวเลือกผิด เราสรุปให้แล้ว',
      'ดูขนาด/รายละเอียดให้ตรงกับการใช้งานก่อนนะ',
      'อันนี้เหมาะกับคนแบบไหน มาดูกัน',
      'ถ้าไม่แน่ใจว่าเหมาะกับคุณไหม เช็ก 3 ข้อนี้',
      'อย่าซื้อเพราะเห็นคนอื่นใช้ ต้องดูว่าตรงกับเราหรือเปล่า',
      'ถ้าตรงตามนี้ คุณน่าจะใช้ได้คุ้ม',
      'เช็กตรงนี้ก่อนซื้อ จะช่วยเลือกง่ายขึ้น',
      'รายละเอียดเล็ก ๆ แต่สำคัญมาก',
      'ถ้าจะสั่งออนไลน์ เราอยากให้เช็กตรงนี้',
      'เลือกให้ตรงกับการใช้งาน แล้วจะรู้สึกว่าคุ้ม',
      'อย่าเพิ่งกด ถ้ายังไม่ได้เช็กข้อนี้',
      'ถ้าเป็นมือใหม่ ดูตรงนี้ก่อน',
      'ใครไม่เคยใช้มาก่อน ฟังอันนี้',
      'ถ้ากลัวใช้ไม่เป็น ตัวนี้มีวิธีง่าย ๆ',
      'ซื้อครั้งแรกควรรู้เรื่องนี้',
      'สิ่งที่คนซื้อใหม่มักมองข้าม',
      'เช็กให้ครบก่อนกดสั่ง จะได้ไม่เลือกผิด'
    ]
  },
  {
    id: 'short-punchy',
    label: 'สั้น คม หยุดนิ้ว',
    position: 'opening',
    funnel: 'Awareness',
    intent: 'A 2-6 word scroll-stopper for the first second — works as large on-screen text as well as spoken.',
    hooks: [
      'อันนี้แหละที่ตามหา',
      'เจอแล้ว ตัวที่อยากให้ลอง',
      'ดูอันนี้ก่อนตัดสินใจ',
      'อย่าเพิ่งเลื่อน',
      'ขอ 10 วินาที',
      'แค่ดูตรงนี้ก่อน',
      'ตัวนี้มีอะไรดี?',
      'ทำไมคนซื้อ?',
      'คุ้มไหม? ดูเลย',
      'ราคาเท่านี้ ได้อะไร?',
      'ใช้จริงเป็นยังไง?',
      'ต่างจากตัวอื่นตรงไหน?',
      'เหมาะกับใคร?',
      'ใครควรมี?',
      'ใครไม่ควรซื้อ?',
      'จุดนี้สำคัญมาก',
      'อย่าดูแค่ราคา',
      'อย่าดูแค่หน้าตา',
      'อย่าซื้อก่อนดูคลิปนี้',
      'ถ้ากำลังหาอยู่ ดูเลย'
    ]
  },
  {
    id: 'friend-advice',
    label: 'พูดเหมือนเพื่อนแนะนำ',
    position: 'opening',
    funnel: 'Consideration',
    intent: 'A friend-to-friend recommendation voice — "I already did the research for you" — casual and direct.',
    hooks: [
      'ถ้าเป็นเพื่อนถาม เราจะแนะนำแบบนี้',
      'ถ้าให้เลือกเอง เราจะดูข้อนี้ก่อน',
      'เอาตรง ๆ ตัวนี้เราชอบตรงนี้',
      'ถ้าเป็นเรา เราจะเลือกแบบนี้',
      'ใครถามว่าควรซื้อไหม เราขอตอบแบบนี้',
      'ถ้าเพื่อนกำลังจะซื้อ เราจะส่งคลิปนี้ให้',
      'อันนี้อยากบอกคนที่กำลังหาอยู่',
      'ใครกำลังจะกดซื้อ ขอให้ดูอันนี้ก่อน',
      'ไม่อยากให้ซื้อพลาด เลยทำคลิปนี้',
      'ถ้าไม่แน่ใจ ส่งคลิปนี้ให้เพื่อนดูก่อนได้',
      'ใครกำลังเลือกอยู่ เราช่วยตัดตัวเลือกให้',
      'ถ้าไม่อยากเสียเวลาหาเอง ดูตัวนี้ก่อน',
      'เราไปลองมาให้แล้ว',
      'อันนี้สรุปให้แบบคนไม่อยากอ่านยาว',
      'ถ้าไม่มีเวลาเทียบหลายร้าน ดูอันนี้',
      'ไม่ต้องเปิดสิบคลิป เราสรุปให้แล้ว',
      'ใครขี้เกียจหาข้อมูล ดูคลิปนี้',
      'เอาแบบเข้าใจง่าย ๆ ตัวนี้คือ…',
      'พูดกันตรง ๆ ข้อดีของมันคือ…',
      'ถ้าจะให้พูดสั้น ๆ ว่าทำไมถึงเลือกตัวนี้…'
    ]
  },
  {
    id: 'reasoned-close',
    label: 'ปิดแบบมีเหตุผล',
    position: 'both',
    funnel: 'Conversion',
    intent: 'Match the product to one specific need or use case ("if you need X, this fits") — a rational reason to act.',
    hooks: [
      'ถ้าใช้งานแบบนี้ ตัวนี้ตอบโจทย์',
      'ถ้าความต้องการของคุณคือข้อนี้ ตัวนี้น่าสนใจ',
      'ถ้าคุณให้ความสำคัญกับเรื่องนี้ ตัวนี้ควรอยู่ในตัวเลือก',
      'ถ้าอยากได้แบบไม่ซับซ้อน ตัวนี้เหมาะ',
      'ถ้าต้องการประหยัดเวลา ตัวนี้ช่วยได้',
      'ถ้าต้องการความสะดวก ตัวนี้ตอบโจทย์',
      'ถ้าต้องการใช้งานบ่อย ตัวนี้น่าดู',
      'ถ้าต้องการของที่หยิบใช้ได้ง่าย ตัวนี้น่าสนใจ',
      'ถ้าเน้นใช้งานจริง ให้ดูตัวนี้',
      'ถ้าเน้นความคุ้ม ลองดูรายละเอียด',
      'ถ้าเน้นความสะดวก ดูข้อนี้',
      'ถ้าเน้นความสวย ดูตรงนี้',
      'ถ้าเน้นประสิทธิภาพ ดูตรงนี้',
      'ถ้าเน้นความง่าย ตัวนี้ทำได้ดี',
      'ถ้าเน้นประหยัดเวลา ตัวนี้น่าจะถูกใจ',
      'ถ้าอยากลดขั้นตอน ตัวนี้ตอบโจทย์',
      'ถ้าต้องใช้ทุกวัน เลือกให้เหมาะสำคัญมาก',
      'ถ้าซื้อไว้ใช้เอง ดูข้อนี้',
      'ถ้าซื้อเป็นของฝาก ดูข้อนี้',
      'ถ้าซื้อให้คนอื่น ดูข้อนี้'
    ]
  },
  {
    id: 'soft-close',
    label: 'ปิดนิ่ม แต่ขายได้',
    position: 'closing',
    funnel: 'Conversion',
    intent: 'A low-pressure close that gives the viewer permission not to buy — which makes the click feel like their own choice.',
    hooks: [
      'ไม่ต้องรีบซื้อ แค่กดเข้าไปดูไว้ก่อน',
      'ถ้าดูแล้วตรงกับที่หาอยู่ ค่อยกดสั่ง',
      'ราคาและรายละเอียดอยู่ในตะกร้าแล้วค่ะ',
      'ใครสนใจลองเปิดดูตัวเลือกก่อน',
      'ถ้าชอบแบบนี้ ตัวนี้มีให้เลือกค่ะ',
      'ใครกำลังหาอยู่ กดดูไว้ก่อน เผื่อเป็นตัวที่ใช่',
      'ดูจบแล้วถ้าชอบ กดเข้าตะกร้าได้เลย',
      'ใครยังไม่แน่ใจ เซฟคลิปนี้ไว้ก่อนก็ได้',
      'ถ้าตรงกับการใช้งานของคุณ ตัวนี้น่าลอง',
      'อยากรู้ว่าตัวเองเหมาะไหม ลองดูรายละเอียดก่อน',
      'ถ้าราคานี้อยู่ในงบ กดดูโปรต่อได้เลย',
      'ใครกำลังตัดสินใจ เราแปะข้อมูลไว้ให้ครบแล้ว',
      'ไม่ต้องเชื่อคำพูดเรา ดูของจริงแล้วตัดสินใจเอง',
      'ถ้าดูแล้วรู้สึกว่า “นี่แหละ” กดไว้ได้เลย',
      'ของที่ใช่ไม่ต้องพูดเยอะ ดูรายละเอียดก็รู้',
      'ถ้ากำลังหาอยู่พอดี ถือว่าเจอกันถูกคลิปแล้ว',
      'ใครที่ดูมาถึงตรงนี้ น่าจะกำลังสนใจอยู่แหละ 😆',
      'ถ้าคุณกำลังจะซื้ออยู่แล้ว ลองดูตัวนี้เป็นตัวเลือก',
      'ชอบค่อยซื้อ ไม่ชอบผ่านได้ แต่ถ้าตรงโจทย์…กดไว้เลย',
      'ถ้าคลิปนี้ทำให้คุณนึกถึงของที่กำลังหาอยู่ กดเข้าไปดูรายละเอียดต่อได้เลยค่ะ 🛒✨'
    ]
  }
];

export const HOOK_LIBRARY_TOTAL = HOOK_CATEGORIES.reduce((sum, c) => sum + c.hooks.length, 0);

export function getHookCategory(id: string | null | undefined): HookCategory | null {
  if (!id) return null;
  return HOOK_CATEGORIES.find((c) => c.id === id) ?? null;
}

// Categories usable in a given slot. 'both' categories appear in both slots.
export function hookCategoriesFor(slot: 'opening' | 'closing'): HookCategory[] {
  return HOOK_CATEGORIES.filter((c) => c.position === slot || c.position === 'both');
}

// Voice options the adapt prompt understands — controls ครับ/ค่ะ so a male
// voiceover never ends a line with "ค่ะ" (several library lines do).
export const HOOK_VOICES = ['ไม่ระบุ (ไม่ใส่ครับ/ค่ะ)', 'ผู้ชาย (ครับ)', 'ผู้หญิง (ค่ะ)'] as const;

export function hookVoiceFromVideoVoice(voiceGender: string | null | undefined): string {
  const g = (voiceGender || '').toLowerCase();
  if (g.includes('female')) return HOOK_VOICES[2];
  if (g.includes('male')) return HOOK_VOICES[1];
  return HOOK_VOICES[0];
}

// AI adapt — few-shot from the selected สาย, grounded in real product facts.
// Response shape (strict JSON): {"hooks":[{"text":string,"angle":string}]}
export function buildHookAdaptMessages(input: {
  product: Pick<Product, 'product_name' | 'brand' | 'category' | 'usp' | 'benefits' | 'usage' | 'allowed_claims' | 'banned_claims'> | null;
  category: HookCategory;
  slot: 'opening' | 'closing';
  count: number;
  voice?: string | null;
}): { system: string; user: string } {
  const { product, category, slot, count, voice } = input;

  const system = `You are a senior Thai direct-response copywriter writing short-video hooks (TikTok / Reels / Shorts) for a Thai DTC brand.

Write ${count} NEW Thai lines in the style of the example lines the user gives you, adapted to the specific product. They must sound like a real Thai person talking, not like an advert.

HARD RULES
- Thai language only. Spoken, natural, everyday wording.
- ${slot === 'opening' ? 'OPENING HOOK: must be sayable in 2-3 seconds (about 6-14 Thai words). It opens a curiosity gap or names the viewer — it does NOT explain the product.' : 'CLOSING LINE: one clear, low-pressure call to action (about 6-16 Thai words). Point to the basket / link / details.'}
- Use ONLY the product facts given. Never invent benefits, ingredients, results, numbers, reviews, awards or how many people bought.
- NEVER state a price, discount, percentage, promo name, coupon code or deadline — none was provided. You may only tell the viewer to check the current price/promo in the basket.
- No medical, cure, or guaranteed-result claims. No before/after promises. Respect "NEVER claim" exactly.
- Do not name or disparage any competitor brand.
- Sentence-ending particle: ${voice && voice.includes('ครับ') ? 'male speaker — use "ครับ" where a particle is natural, never "ค่ะ/คะ".' : voice && voice.includes('ค่ะ') ? 'female speaker — use "ค่ะ/คะ/นะคะ" where a particle is natural, never "ครับ".' : 'gender-neutral — avoid "ครับ" and "ค่ะ" entirely.'}
- Each line must use a different angle. Do not copy an example verbatim; do not repeat yourself.
- You may mention the product type or the specific problem it addresses. Mention the brand name in at most one line.

Respond with strict JSON only: {"hooks":[{"text":"<the Thai line>","angle":"<3-8 Thai words: which product fact or viewer situation this line leans on>"}]}`;

  const productBlock = product
    ? [
        `Product: ${product.product_name}`,
        product.brand ? `Brand: ${product.brand}` : '',
        product.category ? `Category: ${product.category}` : '',
        product.usp ? `USP: ${product.usp}` : '',
        product.benefits ? `Benefits: ${product.benefits}` : '',
        product.usage ? `Usage: ${product.usage}` : '',
        product.allowed_claims ? `Allowed claims: ${product.allowed_claims}` : '',
        product.banned_claims ? `NEVER claim: ${product.banned_claims}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    : 'No product selected — write lines that work for any consumer product, without inventing any product detail.';

  const user = `<product>
${productBlock}
</product>

<hook_style>
Name: ${category.label}
Funnel stage: ${category.funnel}
What this style does: ${category.intent}
</hook_style>

<examples>
${category.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}
</examples>

<instructions>
Write ${count} new ${slot === 'opening' ? 'opening hooks' : 'closing lines'} in this style for this product. JSON only.
</instructions>`;

  return { system, user };
}
