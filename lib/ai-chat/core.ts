import { z } from 'zod';

export const intents = ['GREETING','FAQ','PRODUCT_INTEREST','PRICE','PROMOTION','PRODUCT_RECOMMENDATION','PURCHASE_INTENT','OBJECTION','COMPLAINT','ORDER_STATUS','HUMAN_REQUEST','UNKNOWN'] as const;
export type Intent = typeof intents[number];
export const weights: Record<Intent, number> = { GREETING:0, FAQ:5, PRODUCT_INTEREST:15, PRICE:10, PROMOTION:10, PRODUCT_RECOMMENDATION:15, PURCHASE_INTENT:20, OBJECTION:0, COMPLAINT:0, ORDER_STATUS:0, HUMAN_REQUEST:0, UNKNOWN:0 };
export const rulesSchema = z.object({
  enabled:z.boolean().default(false), mode:z.enum(['AI','HUMAN','HYBRID']).default('HYBRID'),
  fast_model:z.string().trim().max(100).default(''), sales_model:z.string().trim().max(100).default(''), advanced_model:z.string().trim().max(100).default(''),
  confidence_threshold:z.number().min(0.5).max(1).default(0.8), handoff_threshold:z.number().int().min(1).max(100).default(80),
  weights:z.record(z.enum(intents),z.number().int().min(0).max(30)).default(weights),
  phone_weight:z.number().int().min(0).max(30).default(25),
  pricing:z.record(z.string().max(100),z.object({ input:z.number().min(0).max(1000), output:z.number().min(0).max(1000) })).default({})
}).strict();
export type Rules = z.infer<typeof rulesSchema>;
export const defaults = rulesSchema.parse({});
export type Source = { id:string; text:string; product_id:string|null; kind:'product'|'price'|'offer'|'knowledge'|'guardrail' };
export const analysisSchema = z.object({
  intent:z.enum(intents), product_id:z.string().uuid().nullable(), purchase_intent:z.number().min(0).max(1),
  sentiment:z.enum(['POSITIVE','NEUTRAL','NEGATIVE']), needs_human:z.boolean(), confidence:z.number().min(0).max(1),
  answers:z.array(z.object({source_id:z.string().max(160),quote:z.string().min(1).max(600)}).strict()).max(3),
  question:z.enum(['NONE','NEED','AGE','SCENT','ORDER']),
  memory:z.array(z.object({field:z.enum(['child_age','interested_products','scent_preferences','objections','purchase_intent','previous_products','phone','email']),quote:z.string().min(1).max(200)}).strict()).max(8)
}).strict();
export type Analysis = z.infer<typeof analysisSchema>;
export const outputSchema = {
  type:'object', additionalProperties:false,
  properties:{
    intent:{type:'string',enum:[...intents]},product_id:{type:['string','null']},purchase_intent:{type:'number'},
    sentiment:{type:'string',enum:['POSITIVE','NEUTRAL','NEGATIVE']},needs_human:{type:'boolean'},confidence:{type:'number'},
    answers:{type:'array',items:{type:'object',additionalProperties:false,properties:{source_id:{type:'string'},quote:{type:'string'}},required:['source_id','quote']}},
    question:{type:'string',enum:['NONE','NEED','AGE','SCENT','ORDER']},
    memory:{type:'array',items:{type:'object',additionalProperties:false,properties:{field:{type:'string',enum:['child_age','interested_products','scent_preferences','objections','purchase_intent','previous_products','phone','email']},quote:{type:'string'}},required:['field','quote']}}
  },required:['intent','product_id','purchase_intent','sentiment','needs_human','confidence','answers','question','memory']
};

export function preflight(text:string): {intent:Intent; handoff:string|null} {
  if (/คุย.*(คน|แอดมิน|พนักงาน)|ติดต่อ.*เจ้าหน้าที่|human|agent|admin/i.test(text)) return {intent:'HUMAN_REQUEST',handoff:'HUMAN_REQUEST'};
  if (/คืนเงิน|refund|ร้องเรียน|complaint|โกรธ|แย่มาก|ห่วย|โกง|โมโห|angry/i.test(text)) return {intent:'COMPLAINT',handoff:'COMPLAINT_OR_REFUND'};
  if (/โอน.*(ไม่เข้า|ผิด)|ชำระเงิน.*(ปัญหา|ไม่ได้)|ตัดเงิน|payment.*(fail|problem)|เลขพัสดุ|ตาม.*(ออเดอร์|สินค้า)|สถานะ.*(ออเดอร์|จัดส่ง)|order.*status|ยังไม่ได้รับ/i.test(text)) return {intent:'ORDER_STATUS',handoff:'ORDER_OR_PAYMENT'};
  if (/แพ้|ผื่น|ตั้งครรภ์|ทารก|รักษาโรค|อันตราย|allerg|medical|ปลอดภัย.*100|system prompt|api.?key|ignore.*instruction|ข้อมูล.*ลูกค้า.*อื่น/i.test(text)) return {intent:'UNKNOWN',handoff:'SENSITIVE_QUESTION'};
  if (/มีของ|ของหมด|สต็อก|stock|พร้อมส่ง/i.test(text)) return {intent:'UNKNOWN',handoff:'STOCK_REQUIRES_CONFIRMATION'};
  if (/สั่ง(ซื้อ|ยังไง)|ซื้อ.*ยังไง|เอา.*(ขวด|ชิ้น)|ชำระ.*ยังไง|how.*(buy|order)/i.test(text)) return {intent:'PURCHASE_INTENT',handoff:null};
  if (/โปรโมชั่น|โปรอะไร|มีโปร|promotion|ส่วนลด/i.test(text)) return {intent:'PROMOTION',handoff:null};
  if (/ราคา|กี่บาท|เท่าไหร่|เท่าไร|price/i.test(text)) return {intent:'PRICE',handoff:null};
  if (/แนะนำ|เหมาะ|เลือก.*(กลิ่น|สินค้า)|recommend/i.test(text)) return {intent:'PRODUCT_RECOMMENDATION',handoff:null};
  if (/กี่ขวบ|วิธีใช้|กี่กลิ่น|how to|ใช้ยังไง/i.test(text)) return {intent:'FAQ',handoff:null};
  if (/^(hello|hi|สวัสดี|หวัดดี)[! .ค่ะครับคะ]*$/i.test(text.trim())) return {intent:'GREETING',handoff:null};
  return {intent:'UNKNOWN',handoff:null};
}
export function routeTier(text:string,intent:Intent): 'fast'|'sales'|'advanced' {
  if (text.length>500 || /เปรียบเทียบ|หลาย.*เงื่อนไข|เทียบ.*กับ|compare/i.test(text)) return 'advanced';
  return ['GREETING','FAQ','PRICE','PROMOTION'].includes(intent)?'fast':'sales';
}
export function scoreDelta(intent:Intent,text:string,rules:Rules) {
  if (['COMPLAINT','ORDER_STATUS','HUMAN_REQUEST','UNKNOWN','OBJECTION'].includes(intent)) return 0;
  return (rules.weights[intent] ?? weights[intent]) + (/\b0[689]\d{8}\b/.test(text)?rules.phone_weight:0);
}
export function withinWindow(last:string,now=Date.now()) { const elapsed=now-Date.parse(last); return Number.isFinite(elapsed)&&elapsed>=0&&elapsed<24*60*60*1000; }
export function activeAt(row:{status?:string;starts_at?:string|null;ends_at?:string|null;effective_from?:string|null;effective_to?:string|null},now=Date.now()) {
  const start=row.starts_at||row.effective_from,end=row.ends_at||row.effective_to;
  return row.status==='active'&&(!start||Date.parse(start)<=now)&&(!end||Date.parse(end)>now);
}
const questions = { NONE:'', NEED:'สนใจสินค้าแบบไหนหรืออยากให้ช่วยเรื่องใดเป็นพิเศษคะ', AGE:'น้องอายุประมาณกี่ขวบคะ', SCENT:'ชอบกลิ่นแนวไหนเป็นพิเศษคะ', ORDER:'ต้องการให้ช่วยแนะนำขั้นตอนสั่งซื้อไหมคะ' };
export function groundedReply(a:Analysis,sources:Source[]):string|null {
  if(a.intent==='GREETING'&&!a.answers.length) return 'สวัสดีค่ะ ยินดีช่วยแนะนำสินค้าของ ZANA ค่ะ สนใจสินค้าตัวไหนคะ';
  if(!a.answers.length) return null;
  const quoted:string[]=[];
  for(const answer of a.answers) {
    const source=sources.find(s=>s.id===answer.source_id);
    // Full approved snippets avoid cutting a negation/restriction out of a sentence.
    if(!source||source.kind==='guardrail'||source.text!==answer.quote) return null;
    if(a.product_id&&source.product_id&&a.product_id!==source.product_id) return null;
    if(a.intent==='PRICE'&&!['price','offer'].includes(source.kind)) return null;
    if(a.intent==='PROMOTION'&&source.kind!=='offer') return null;
    quoted.push(answer.quote);
  }
  const reply=['ได้เลยค่ะ',...quoted,questions[a.question]].filter(Boolean).join('\n');
  return reply.length<=1800?reply:null;
}
export function evidenceMemory(a:Analysis,text:string,messageId:string,existing:unknown[]) {
  const accepted=a.memory.filter(m=>text.includes(m.quote)).map(m=>({...m,source_message_id:messageId}));
  const seen=new Set<string>();
  return [...accepted,...existing].filter(f=>{const key=JSON.stringify(f);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,30);
}
