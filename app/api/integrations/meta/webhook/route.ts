import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { receiveMessage, secureEqual, validSignature } from '@/lib/ai-chat/meta';
import { boundedBody, ChatError, checked, getRules } from '@/lib/ai-chat/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const q=new URL(request.url).searchParams,token=process.env.META_VERIFY_TOKEN;
  if(!token)return new Response('Not configured',{status:503});
  if(q.get('hub.mode')!=='subscribe'||!secureEqual(q.get('hub.verify_token')||'',token)||!q.get('hub.challenge'))return new Response('Forbidden',{status:403});
  return new Response(q.get('hub.challenge'),{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  try {
    if(!process.env.META_APP_SECRET||!process.env.META_PAGE_ID)return NextResponse.json({error:'NOT_CONFIGURED'},{status:503});
    const raw=await boundedBody(request);
    if(!validSignature(raw,request.headers.get('x-hub-signature-256'),process.env.META_APP_SECRET))return NextResponse.json({error:'INVALID_SIGNATURE'},{status:401});
    let events;
    try{events=receiveMessage(JSON.parse(raw.toString('utf8')),process.env.META_PAGE_ID);}catch{return NextResponse.json({error:'INVALID_EVENT'},{status:400});}
    const db=createServiceRoleClient();
    const {data:allowed}=checked(await db.rpc('chat_rate_limit',{p_bucket:`webhook:${process.env.META_PAGE_ID}`,p_limit:300,p_seconds:60}));
    if(!allowed)return NextResponse.json({error:'RATE_LIMITED'},{status:429});
    const rules=await getRules(db);
    if(events.length)checked(await db.rpc('chat_ingest_batch',{p_events:events,p_enabled:rules.enabled&&rules.mode!=='HUMAN'}));
    return NextResponse.json({received:true});
  }catch(error){return NextResponse.json({error:error instanceof ChatError?error.code:'WEBHOOK_STORAGE_FAILED'},{status:error instanceof ChatError?error.status:503});}
}
