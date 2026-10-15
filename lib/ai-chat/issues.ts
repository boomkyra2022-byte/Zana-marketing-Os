// Shared safe status vocabulary. Never show raw provider error messages: they can contain credentials.
const messages:Record<string,string>={
  OPENAI_INVALID_API_KEY:'OpenAI ปฏิเสธ API Key กรุณาให้ผู้ดูแลเปลี่ยน Key ในการตั้งค่าฝั่งเซิร์ฟเวอร์',
  OPENAI_IP_NOT_AUTHORIZED:'OpenAI ไม่อนุญาต IP ของเซิร์ฟเวอร์นี้ กรุณาตรวจ IP allowlist ของโครงการ',
  OPENAI_HTTP_401:'OpenAI ยืนยันสิทธิ์ไม่ผ่าน กรุณาตรวจ API Key และสิทธิ์ของโครงการ',
  OPENAI_HTTP_403:'บัญชีหรือ Key ไม่มีสิทธิ์สำหรับคำขอนี้ กรุณาตรวจสิทธิ์ใน OpenAI',
  OPENAI_QUOTA_EXCEEDED:'โควตาหรือเครดิต OpenAI ไม่เพียงพอ กรุณาให้ผู้ดูแลตรวจบัญชี',
  OPENAI_RATE_LIMITED:'OpenAI จำกัดจำนวนคำขอชั่วคราว กรุณารอสักครู่แล้วลองใหม่',
  OPENAI_MODEL_NOT_FOUND:'ไม่พบรุ่น AI ที่ตั้งไว้ หรือบัญชีไม่มีสิทธิ์ใช้รุ่นนี้',
  OPENAI_TIMEOUT_OR_NETWORK:'ติดต่อ OpenAI ไม่สำเร็จหรือเกินเวลารอ ให้ทีมดูแลบทสนทนานี้',
  OPENAI_INCOMPLETE:'OpenAI ตอบไม่ครบ ระบบส่งต่อให้ทีมตรวจ',
  OPENAI_REFUSAL:'AI ไม่สามารถตอบคำถามนี้ได้ ให้แอดมินดูแลต่อ',
  OPENAI_INVALID_RESPONSE:'OpenAI ส่งคำตอบที่ระบบอ่านไม่ได้ กรุณาลองตรวจการเชื่อมต่ออีกครั้ง',
  AI_NOT_CONFIGURED:'ยังไม่ได้ตั้ง API Key หรือรุ่น AI',
  AI_KNOWLEDGE_CHANGED:'ข้อมูลสินค้าหรือโปรโมชั่นเปลี่ยนก่อนส่ง ให้ทีมตรวจข้อมูลล่าสุด',
  CHAT_MIGRATION_REQUIRED:'ยังไม่ได้ติดตั้งฐานข้อมูล AI Chat ให้ผู้ดูแลรัน Migration 0029 ก่อนใช้งาน',
  CHAT_DATABASE_ERROR:'เชื่อมต่อข้อมูล AI Chat ไม่สำเร็จ กรุณาตรวจฐานข้อมูลและสิทธิ์',
  META_NOT_CONFIGURED:'ยังตั้งค่า Messenger ไม่ครบ',
  META_PAGE_MISMATCH:'เพจของบทสนทนาไม่ตรงกับเพจที่ระบบเชื่อมต่ออยู่',
  META_TIMEOUT_OR_NETWORK:'ไม่ทราบผลส่งไป Messenger กรุณาตรวจใน Messenger ก่อนส่งซ้ำ',
  DELIVERY_UNKNOWN:'ไม่ทราบผลส่ง กรุณาตรวจใน Messenger ก่อนส่งซ้ำ',
  WINDOW_EXPIRED:'พ้นช่วงตอบกลับ 24 ชั่วโมงแล้ว รอลูกค้าทักใหม่',
  MODE_OR_WINDOW_CHANGED:'ยกเลิกข้อความเพราะเปลี่ยนผู้ดูแลหรือพ้นช่วงตอบกลับ',
  HUMAN_REQUEST:'ลูกค้าขอคุยกับแอดมิน', COMPLAINT_OR_REFUND:'เรื่องร้องเรียนหรือขอคืนเงิน',
  ORDER_OR_PAYMENT:'ต้องตรวจออเดอร์หรือการชำระเงิน', SENSITIVE_QUESTION:'คำถามที่ต้องให้แอดมินตรวจ',
  STOCK_REQUIRES_CONFIRMATION:'ต้องยืนยันสต็อกกับทีม', ATTACHMENT_OR_UNSUPPORTED_MESSAGE:'มีไฟล์แนบหรือข้อความที่ต้องให้ทีมตรวจ',
  AI_REQUESTED_HANDOFF:'AI ส่งต่อให้แอดมิน', LOW_CONFIDENCE:'AI ไม่มั่นใจในคำตอบ',
  UNSUPPORTED_ANSWER:'ไม่มีข้อมูลรองรับคำตอบเพียงพอ', NO_APPROVED_KNOWLEDGE:'ยังไม่มีความรู้สินค้าที่อนุมัติสำหรับคำถามนี้',
  HIGH_LEAD_SCORE:'Lead Score ถึงเกณฑ์ ให้ทีมขายรับช่วง', AI_DISABLED:'ปิดระบบตอบอัตโนมัติ', MANUAL_OFF:'แอดมินปิด AI ในบทสนทนานี้',
  WORKER_INTERRUPTED:'การประมวลผลหยุดกลางทาง ให้ทีมตรวจบทสนทนา', CHAT_PROCESSING_FAILED:'ประมวลผลไม่สำเร็จ ให้ทีมดูแลต่อ'
};
export function describeChatIssue(code:string|null|undefined):string {
  if(!code)return '';
  if(messages[code])return messages[code];
  if(/^OPENAI_HTTP_\d{3}$/.test(code))return `OpenAI ไม่พร้อมให้บริการ (${code.slice(-3)}) กรุณาตรวจการเชื่อมต่อ`;
  if(/^META_HTTP_\d{3}$/.test(code))return `Messenger ปฏิเสธคำขอ (${code.slice(-3)}) กรุณาตรวจ Token และสิทธิ์ของเพจ`;
  // Thai API validation messages are authored by our server. Other unknown codes get a safe generic label.
  return /[ก-๙]/.test(code)?code:'ระบบยังไม่พร้อม กรุณาให้ผู้ดูแลตรวจการเชื่อมต่อ';
}
export function openAIErrorCode(status:number,payload:unknown):string {
  const code=(payload as {error?:{code?:unknown}}|null)?.error?.code;
  if(status===401&&code==='invalid_api_key')return 'OPENAI_INVALID_API_KEY';
  if(status===401&&code==='ip_not_authorized')return 'OPENAI_IP_NOT_AUTHORIZED';
  if(status===429&&['insufficient_quota','credit_balance_exhausted','organization_usage_limit_exceeded'].includes(String(code)))return 'OPENAI_QUOTA_EXCEEDED';
  if(status===429)return 'OPENAI_RATE_LIMITED';
  if(status===404&&code==='model_not_found')return 'OPENAI_MODEL_NOT_FOUND';
  return `OPENAI_HTTP_${status}`;
}
export function missingChatSchema(error:unknown):boolean {
  return ['PGRST202','42883'].includes(String((error as {code?:unknown}|null)?.code));
}
export function canReadSetupWithoutMigration(request:Request,write:boolean,allowed:boolean,error:unknown):boolean {
  const url=new URL(request.url);
  return allowed&&!write&&request.method==='GET'&&url.pathname==='/api/ai-chat'&&url.searchParams.get('view')==='setup'&&missingChatSchema(error);
}
