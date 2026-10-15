import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { z } from 'zod';

export function secureEqual(a:string,b:string) { const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length&&timingSafeEqual(x,y); }
export function validSignature(raw:Buffer,signature:string|null,secret:string|undefined) {
  if(!secret||!signature||!/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  return secureEqual('sha256='+createHmac('sha256',secret).update(raw).digest('hex'),signature.toLowerCase());
}
const eventSchema=z.object({
  sender:z.object({id:z.string().min(1).max(100)}).optional(),recipient:z.object({id:z.string().min(1).max(100)}).optional(),timestamp:z.number().int().positive().optional(),
  message:z.object({mid:z.string().min(1).max(250),text:z.string().max(20000).optional(),is_echo:z.boolean().optional(),attachments:z.array(z.object({type:z.string().max(50),payload:z.object({url:z.string().max(4000).optional()}).passthrough()})).max(20).optional()}).optional(),
  postback:z.object({mid:z.string().max(250).optional(),title:z.string().max(2000).optional(),payload:z.string().max(2000).optional(),referral:z.record(z.unknown()).optional()}).optional(),
  referral:z.record(z.unknown()).optional()
});
const envelope=z.object({object:z.literal('page'),entry:z.array(z.object({id:z.string(),messaging:z.array(eventSchema).max(500).optional()})).max(100)});
export type Inbound = {page_id:string;sender_id:string;mid:string;text:string;timestamp:string;attachments:unknown[];postback?:unknown;referral?:unknown};
export function receiveMessage(payload:unknown,pageId:string):Inbound[] {
  const data=envelope.parse(payload); const events:Inbound[]=[];
  for(const entry of data.entry) {
    if(entry.id!==pageId) continue;
    for(const e of entry.messaging||[]) {
      if(!e.sender||e.sender.id===pageId||e.recipient?.id!==pageId||e.message?.is_echo||(!e.message&&!e.postback)) continue;
      if(!e.timestamp) throw new Error('MISSING_TIMESTAMP');
      const id=e.message?.mid||e.postback?.mid||'postback:'+createHash('sha256').update(JSON.stringify([pageId,e.sender.id,e.timestamp,e.postback])).digest('hex');
      const referral=e.referral||e.postback?.referral;
      events.push({page_id:pageId,sender_id:e.sender.id,mid:id,text:(e.message?.text||e.postback?.title||e.postback?.payload||'').replace(/\u0000/g,''),timestamp:new Date(e.timestamp).toISOString(),attachments:(e.message?.attachments||[]).map(a=>({type:a.type,url:a.payload.url||null})),...(e.postback?{postback:e.postback}:{}),...(referral?{referral}: {})});
    }
  }
  return events;
}

// Webhook diagnostics (see supabase/migrations/0030). Describes the SHAPE of a
// validly signed payload — Page ids and key names only, never message text,
// names, tokens or attachment URLs — so a rejected/ignored delivery can be
// explained afterwards (wrong Page id? events arriving as `standby`? the
// dashboard "Test" shape with `changes`?).
export type EnvelopeShape = { entries:number; pageMatch:boolean; entryIds:string[]; entryKeys:string[]; eventKinds:string[] };
export function describeEnvelope(payload:unknown,pageId:string):EnvelopeShape {
  const out:EnvelopeShape={entries:0,pageMatch:false,entryIds:[],entryKeys:[],eventKinds:[]};
  const entries=(payload&&typeof payload==='object'&&Array.isArray((payload as {entry?:unknown}).entry))?(payload as {entry:unknown[]}).entry:[];
  out.entries=entries.length;
  const keys=new Set<string>(),kinds=new Set<string>();
  for(const raw of entries.slice(0,20)) {
    if(!raw||typeof raw!=='object') continue;
    const e=raw as Record<string,unknown>;
    if(out.entryIds.length<3) out.entryIds.push(String(e.id??'').slice(0,30));
    if(String(e.id)===pageId) out.pageMatch=true;
    for(const k of Object.keys(e)) if(k!=='id'&&k!=='time') keys.add(k.slice(0,30));
    const list=[...(Array.isArray(e.messaging)?e.messaging:[]),...(Array.isArray(e.standby)?e.standby:[])];
    for(const m of list.slice(0,50)) if(m&&typeof m==='object') for(const k of Object.keys(m)) if(!['sender','recipient','timestamp'].includes(k)) kinds.add(k.slice(0,30));
    if(Array.isArray(e.changes)) for(const c of e.changes.slice(0,20)) if(c&&typeof (c as {field?:unknown}).field==='string') kinds.add('changes:'+String((c as {field:string}).field).slice(0,30));
  }
  out.entryKeys=[...keys].sort();out.eventKinds=[...kinds].sort();
  return out;
}
export function formatEnvelope(s:EnvelopeShape):string {
  return `ids=${s.entryIds.join(',')||'-'}; page_match=${s.pageMatch}; entry_keys=${s.entryKeys.join(',')||'-'}; kinds=${s.eventKinds.join(',')||'-'}`;
}
// Parse failures are summarized by schema path/code only: V8's JSON.parse
// message can quote a fragment of the body, which could contain message text.
export function describeParseError(error:unknown):string {
  if(error instanceof z.ZodError) return error.issues.slice(0,5).map(i=>`${i.path.join('.')||'(root)'}:${i.code}`).join(' | ');
  if(error instanceof Error&&error.message==='MISSING_TIMESTAMP') return 'MISSING_TIMESTAMP';
  return 'PARSE_ERROR';
}
export class MetaError extends Error { constructor(public code:string,public uncertain=false){super(code);} }
export class MetaMessengerService {
  receiveMessage=receiveMessage;
  private config(){
    const page=process.env.META_PAGE_ID,token=process.env.META_PAGE_ACCESS_TOKEN,version=process.env.META_MESSENGER_API_VERSION;
    if(!page||!token||!version||!/^v\d+\.\d+$/.test(version)) throw new MetaError('META_NOT_CONFIGURED');
    return {page,token,version};
  }
  async sendMessage(psid:string,text:string) {
    const result=await this.send(psid,{message:{text},messaging_type:'RESPONSE'});
    if(typeof result.message_id!=='string') throw new MetaError('META_INVALID_RESPONSE',true);
    return result.message_id as string;
  }
  async sendTypingIndicator(psid:string){await this.send(psid,{sender_action:'typing_on'});}
  async markSeen(psid:string){await this.send(psid,{sender_action:'mark_seen'});}
  private async send(psid:string,body:Record<string,unknown>) {
    const {page,token,version}=this.config(); let res:Response;
    try { res=await fetch(`https://graph.facebook.com/${version}/${page}/messages`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({recipient:{id:psid},...body}),signal:AbortSignal.timeout(10000)}); }
    catch {throw new MetaError('META_TIMEOUT_OR_NETWORK',true);}
    if(!res.ok) throw new MetaError(`META_HTTP_${res.status}`,res.status>=500);
    try{return await res.json();}catch{throw new MetaError('META_INVALID_RESPONSE',true);}
  }
  async getUserProfile(psid:string) {
    const {token,version}=this.config();
    const res=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(psid)}?fields=first_name,last_name`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
    if(!res.ok) throw new MetaError(`META_PROFILE_${res.status}`);
    return z.object({first_name:z.string().max(200).optional(),last_name:z.string().max(200).optional()}).parse(await res.json());
  }
}
