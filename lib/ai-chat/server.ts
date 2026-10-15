import 'server-only';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { activeAt, defaults, rulesSchema, type Rules, type Source } from './core';
import { canReadSetupWithoutMigration, missingChatSchema } from './issues';

export class ChatError extends Error {constructor(public code:string,public status=400){super(code);}}
export function checked<T extends {error:unknown}>(result:T):T {if(result.error) throw new ChatError('CHAT_DATABASE_ERROR',503);return result;}
// Best-effort webhook diagnostics row (migration 0030). Must NEVER change how the
// webhook answers Meta: every failure here is swallowed.
export async function recordWebhook(e:{outcome:string;status:number;bytes?:number;hasSig?:boolean;ua?:string|null;entries?:number;events?:number;detail?:string}):Promise<void> {
  try {
    await createServiceRoleClient().rpc('chat_log_webhook',{p_outcome:e.outcome,p_status:e.status,p_bytes:e.bytes??null,p_has_sig:e.hasSig??null,p_ua:e.ua??null,p_entries:e.entries??null,p_events:e.events??null,p_detail:e.detail??null});
  } catch { /* diagnostics only */ }
}
export async function getRules(db:ReturnType<typeof createServiceRoleClient>):Promise<Rules> {
  const {data}=checked(await db.from('settings').select('value').eq('key','ai_chat').maybeSingle());
  return rulesSchema.parse(data?.value||defaults);
}
export async function guard(request:Request,write=false,ownerOnly=false,allowSetupBeforeMigration=false) {
  const session=createClient();const {data:{user}}=await session.auth.getUser();
  if(!user) throw new ChatError('กรุณาเข้าสู่ระบบ',401);
  const {data:profile}=await session.from('profiles').select('role,status').eq('id',user.id).single();
  if(!profile||profile.status!=='approved'||!(ownerOnly?['owner','admin']:['owner','admin','content_lead']).includes(profile.role)) throw new ChatError('ไม่มีสิทธิ์เข้าถึงข้อมูลลูกค้า',403);
  if(write) {
    const origin=request.headers.get('origin');
    if(!origin||origin!==new URL(request.url).origin) throw new ChatError('INVALID_ORIGIN',403);
  }
  const db=createServiceRoleClient();
  const limit=await db.rpc('chat_rate_limit',{p_bucket:`${write?'write':'read'}:${user.id}`,p_limit:write?60:180,p_seconds:60});
  // A read-only setup view remains available to approved operators before the additive migration.
  // Never use this exception for mutations, provider checks, or any other view.
  if(missingChatSchema(limit.error)) {
    if(canReadSetupWithoutMigration(request,write,allowSetupBeforeMigration,limit.error))return {db,user,profile,migrationReady:false};
    throw new ChatError('CHAT_MIGRATION_REQUIRED',503);
  }
  const {data:allowed}=checked(limit);
  if(!allowed) throw new ChatError('กรุณารอสักครู่แล้วลองใหม่',429);
  return {db,user,profile,migrationReady:true};
}
export async function boundedBody(request:Request,max=1024*1024):Promise<Buffer> {
  if(Number(request.headers.get('content-length'))>max) throw new ChatError('PAYLOAD_TOO_LARGE',413);
  const reader=request.body?.getReader();if(!reader)return Buffer.alloc(0);
  const chunks:Uint8Array[]=[];let size=0;
  try { while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new ChatError('PAYLOAD_TOO_LARGE',413);}chunks.push(value);} }
  finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
export async function knowledge(db:ReturnType<typeof createServiceRoleClient>,text:string,previousProduct:string|null):Promise<Source[]> {
  const {data:approved}=checked(await db.from('chat_product_knowledge').select('*').eq('approved',true).limit(100));
  if(!approved?.length) return [];
  const {data:catalog}=checked(await db.from('products').select('id,product_name,sku,selling_price,usage,benefits,allowed_claims,banned_claims,compliance_notes,status').in('id',approved.map((a:{product_id:string})=>a.product_id)).eq('status','active'));
  const lower=text.toLowerCase();
  const matched=(catalog||[]).filter((p:any)=>p.id===previousProduct||[p.product_name,p.sku].filter(Boolean).some((n:string)=>lower.includes(n.toLowerCase())));
  const products=(matched.length?matched:catalog||[]).slice(0,8);const ids=products.map((p:any)=>p.id);if(!ids.length)return [];
  const now=new Date().toISOString();
  const [offerResult,kbResult]=await Promise.all([
    db.from('offers').select('id,product_id,name,price,bundle,voucher,free_gift,starts_at,ends_at,status').in('product_id',ids).eq('status','active').or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`).limit(40),
    db.from('knowledge_items').select('id,title,content,product_ids,status,effective_from,effective_to').eq('status','active').in('type',['FAQ','PRODUCT','BRAND','COMPLIANCE']).or(`effective_from.is.null,effective_from.lte.${now}`).or(`effective_to.is.null,effective_to.gt.${now}`).order('updated_at',{ascending:false}).limit(40)
  ]);
  checked(offerResult);checked(kbResult);
  const sources:Source[]=[];
  const add=(id:string,body:unknown,product_id:string|null,kind:Source['kind'])=>{if(typeof body==='string'&&body.trim()&&body.length<=600)sources.push({id,text:body.trim(),product_id,kind});};
  for(const p of products) {
    const extra=approved.find((a:any)=>a.product_id===p.id);
    add(`product:${p.id}:name`,p.product_name,p.id,'product');
    if(p.selling_price!==null)add(`price:${p.id}`,`${p.product_name} ราคา ${p.selling_price} บาท`,p.id,'price');
    // Claims are approved fields only; no raw marketing benefits, stock, cost/margins or legacy promo fields.
    const labels:Record<string,string>={usage:'วิธีใช้',allowed_claims:'ข้อมูลสินค้า',compliance_notes:'ข้อควรระวัง'};
    for(const field of ['usage','allowed_claims','compliance_notes']) add(`product:${p.id}:${field}`,p[field]?`${p.product_name} — ${labels[field]}: ${p[field]}`:'',p.id,'product');
    add(`product:${p.id}:banned_claims`,p.banned_claims?`ห้ามกล่าวอ้าง: ${p.banned_claims}`:'',p.id,'guardrail');
    for(const field of ['age_requirement','faq','restrictions','upsell','cross_sell'])add(`product:${p.id}:${field}`,extra?.[field]?`${p.product_name} — ${extra[field]}`:'',p.id,'product');
  }
  for(const o of offerResult.data||[]) {
    if(!activeAt(o)||o.price===null)continue;
    const p=products.find((p:any)=>p.id===o.product_id);
    add(`offer:${o.id}`,`${p.product_name} — ${o.name}: ${o.price} บาท${o.voucher?` • คูปอง ${o.voucher}`:''}${o.free_gift?` • ของแถม ${o.free_gift}`:''}${o.ends_at?` • สิ้นสุด ${new Date(o.ends_at).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})}`:''}`,o.product_id,'offer');
  }
  for(const k of kbResult.data||[]) {
    const linked=Array.isArray(k.product_ids)?k.product_ids:[];
    if(!activeAt(k)||(linked.length&&!linked.some((id:string)=>ids.includes(id))))continue;
    // Do not let freeform KB override the live offer/price source.
    if(/บาท|ราคา|โปรโมชั่น|ส่วนลด|stock|สต็อก/i.test(k.content))continue;
    add(`knowledge:${k.id}`,k.content,linked.length===1?linked[0]:null,'knowledge');
    if(sources.length>=60)break;
  }
  return sources.slice(0,60);
}
