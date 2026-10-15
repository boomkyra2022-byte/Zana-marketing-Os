import { NextResponse } from 'next/server';
import { z } from 'zod';
import { boundedBody, ChatError, checked, getRules, guard } from '@/lib/ai-chat/server';
import { rulesSchema } from '@/lib/ai-chat/core';
import { checkOpenAIConnection } from '@/lib/ai-chat/ai';
import { describeChatIssue } from '@/lib/ai-chat/issues';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const id=z.string().uuid();
const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('check_openai')}),
  z.object({action:z.enum(['takeover','off','return','close']),id}),
  z.object({action:z.literal('assign'),id,assignee:id.nullable()}),
  z.object({action:z.literal('send'),id,text:z.string().trim().min(1).max(1800),request_id:id}),
  z.object({action:z.literal('customer'),id,first_name:z.string().max(100),last_name:z.string().max(100),phone:z.string().max(40),email:z.union([z.string().email(),z.literal('')]),tags:z.array(z.string().trim().min(1).max(40)).max(20),notes:z.string().max(5000)}),
  z.object({action:z.literal('rules'),rules:rulesSchema}),
  z.object({action:z.literal('product_knowledge'),product_id:id,age_requirement:z.string().max(500),faq:z.string().max(500),restrictions:z.string().max(500),upsell:z.string().max(500),cross_sell:z.string().max(500),approved:z.boolean()}),
  z.object({action:z.literal('offer'),id:id.optional(),product_id:id,name:z.string().trim().min(1).max(180),price:z.number().min(0).max(1e7),voucher:z.string().max(100),free_gift:z.string().max(100),starts_at:z.string().datetime().nullable(),ends_at:z.string().datetime().nullable(),status:z.enum(['active','inactive'])})
]);
function fail(error:unknown) {
  if(error instanceof z.ZodError)return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง กรุณาตรวจช่องที่กรอก'},{status:400});
  return NextResponse.json({error:error instanceof ChatError?describeChatIssue(error.code):'ระบบ AI Chat ยังไม่พร้อม กรุณาตรวจ Migration และการเชื่อมต่อ'},{status:error instanceof ChatError?error.status:503});
}
export async function GET(request:Request) {
  try {
    const q=new URL(request.url).searchParams;
    const {db,profile,user,migrationReady}=await guard(request,false,false,q.get('view')==='setup');
    const view=q.get('view')||'inbox';const offset=z.coerce.number().int().min(0).max(100000).parse(q.get('offset')||0);
    if(view==='setup') {
      const rules=await getRules(db);
      const {data:team}=checked(await db.from('profiles').select('id,full_name,role').eq('status','approved').in('role',['owner','admin','content_lead']));
      return NextResponse.json({rules,team,role:profile.role,user_id:user.id,migration_ready:migrationReady,configured:{meta:!!(process.env.META_PAGE_ID&&process.env.META_PAGE_ACCESS_TOKEN&&process.env.META_APP_SECRET&&process.env.META_VERIFY_TOKEN&&process.env.META_MESSENGER_API_VERSION),openai:!!process.env.OPENAI_API_KEY,worker:!!process.env.AI_CHAT_WORKER_SECRET}});
    }
    if(view==='inbox'||view==='conversations') {
      let query=db.from('chat_conversations').select('*,customer:chat_customers(*)').order('last_message_at',{ascending:false}).order('id',{ascending:false});
      const status=q.get('status');if(status)query=query.eq('status',z.enum(['AI_ACTIVE','HUMAN_ACTIVE','WAITING_ADMIN','CLOSED']).parse(status));
      else if(view==='inbox')query=query.neq('status','CLOSED');
      const {data}=checked(await query.range(offset,offset+49));return NextResponse.json({rows:data,hasMore:data?.length===50});
    }
    if(view==='thread') {
      const conv=id.parse(q.get('id'));
      const {data:conversation}=checked(await db.from('chat_conversations').select('*,customer:chat_customers(*)').eq('id',conv).single());
      let query=db.from('chat_messages').select('*,product:products(product_name)').eq('conversation_id',conv).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
      const before=q.get('before');if(before){const [stamp,mid]=before.split('|');z.string().datetime({offset:true}).parse(stamp);id.parse(mid);query=query.or(`created_at.lt.${stamp},and(created_at.eq.${stamp},id.lt.${mid})`);}
      const [{data:messages},{data:memory}]=await Promise.all([query.then(checked),db.from('chat_customer_memory').select('*').eq('customer_id',conversation.customer_id).single().then(checked)]);
      return NextResponse.json({conversation,messages:[...(messages||[])].reverse(),memory,hasMore:messages?.length===100});
    }
    if(view==='customers') {
      const {data}=checked(await db.from('chat_customers').select('*').order('updated_at',{ascending:false}).range(offset,offset+49));return NextResponse.json({rows:data,hasMore:data?.length===50});
    }
    if(view==='knowledge') {
      const [p,k,o]=await Promise.all([db.from('products').select('id,product_name,sku,selling_price,status').order('product_name').limit(500),db.from('chat_product_knowledge').select('*').limit(500),db.from('offers').select('*').order('created_at',{ascending:false}).limit(100)]);
      return NextResponse.json({products:checked(p).data,knowledge:checked(k).data,offers:checked(o).data});
    }
    if(view==='analytics'){const {data}=checked(await db.rpc('chat_analytics'));return NextResponse.json(data);}
    throw new ChatError('INVALID_VIEW');
  }catch(error){return fail(error);}
}
export async function POST(request:Request) {
  try {
    const {db,user,profile}=await guard(request,true);
    let body:unknown;try{body=JSON.parse((await boundedBody(request,32000)).toString('utf8'));}catch(error){if(error instanceof ChatError)throw error;throw new ChatError('INVALID_JSON');}
    const data=actionSchema.parse(body);
    if(['rules','product_knowledge','offer','check_openai'].includes(data.action)&&!['owner','admin'].includes(profile.role))throw new ChatError('เฉพาะ Owner / Admin เท่านั้น',403);
    if(data.action==='check_openai') {
      const {data:allowed}=checked(await db.rpc('chat_rate_limit',{p_bucket:`openai-check:${user.id}`,p_limit:3,p_seconds:60}));
      if(!allowed)throw new ChatError('ตรวจได้สูงสุด 3 ครั้งต่อนาที กรุณารอสักครู่',429);
      return NextResponse.json(await checkOpenAIConnection());
    }else if(data.action==='rules') {
      checked(await db.from('settings').upsert({key:'ai_chat',value:data.rules,updated_at:new Date().toISOString()}));
    }else if(data.action==='product_knowledge') {
      const {action,...value}=data;checked(await db.from('chat_product_knowledge').upsert({...value,updated_at:new Date().toISOString()}));
    }else if(data.action==='offer') {
      if(data.starts_at&&data.ends_at&&data.starts_at>=data.ends_at)throw new ChatError('วันสิ้นสุดต้องอยู่หลังวันเริ่ม');
      const {action,id:offerId,...value}=data;
      if(offerId)checked(await db.from('offers').update(value).eq('id',offerId).select('id').single());else checked(await db.from('offers').insert(value));
    }else if(data.action==='customer') {
      // Atomic RPC prevents profile and note partial saves.
      checked(await db.rpc('chat_update_customer',{p_id:data.id,p_actor:user.id,p_data:data}));
    }else {
      if(data.action==='return') {const rules=await getRules(db);if(!rules.enabled||rules.mode==='HUMAN')throw new ChatError('เปิด AI ใน AI Rules ก่อนส่งคืน AI');}
      const result=await db.rpc('chat_control',{p_id:data.id,p_action:data.action,p_actor:user.id,p_assignee:data.action==='assign'?data.assignee:null,p_text:data.action==='send'?data.text:null,p_request:data.action==='send'?data.request_id:null});
      if(result.error){const message=String(result.error.message||'');if(message.includes('WINDOW_EXPIRED'))throw new ChatError('พ้นช่วงตอบกลับ 24 ชั่วโมงแล้ว รอลูกค้าทักใหม่');if(message.includes('TAKE_OVER_REQUIRED'))throw new ChatError('กด Take Over ก่อนส่งข้อความ');checked(result);}
    }
    return NextResponse.json({ok:true});
  }catch(error){return fail(error);}
}
