import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { describeEnvelope, describeParseError, formatEnvelope, receiveMessage, secureEqual, validSignature } from '@/lib/ai-chat/meta';
import { boundedBody, ChatError, checked, getRules, recordWebhook } from '@/lib/ai-chat/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const q=new URL(request.url).searchParams,token=process.env.META_VERIFY_TOKEN;
  if(!token)return new Response('Not configured',{status:503});
  if(q.get('hub.mode')!=='subscribe'||!secureEqual(q.get('hub.verify_token')||'',token)||!q.get('hub.challenge'))return new Response('Forbidden',{status:403});
  return new Response(q.get('hub.challenge'),{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  // Every exit records one diagnostics row (migration 0030): outcome, sizes and
  // payload SHAPE only — never message text or secrets. Logging is best-effort
  // and cannot alter the response sent to Meta.
  const hasSig=!!request.headers.get('x-hub-signature-256'),ua=request.headers.get('user-agent');
  let bytes=0;
  const note=(outcome:string,status:number,extra:{entries?:number;events?:number;detail?:string}={})=>recordWebhook({outcome,status,bytes,hasSig,ua,...extra});
  try {
    if(!process.env.META_APP_SECRET||!process.env.META_PAGE_ID){await note('NOT_CONFIGURED',503);return NextResponse.json({error:'NOT_CONFIGURED'},{status:503});}
    const raw=await boundedBody(request);bytes=raw.length;
    if(!validSignature(raw,request.headers.get('x-hub-signature-256'),process.env.META_APP_SECRET)){await note('INVALID_SIGNATURE',401);return NextResponse.json({error:'INVALID_SIGNATURE'},{status:401});}
    let payload:unknown,events;
    try{payload=JSON.parse(raw.toString('utf8'));events=receiveMessage(payload,process.env.META_PAGE_ID);}catch(error){await note('INVALID_EVENT',400,{detail:describeParseError(error)});return NextResponse.json({error:'INVALID_EVENT'},{status:400});}
    const shape=describeEnvelope(payload,process.env.META_PAGE_ID),detail=formatEnvelope(shape);
    const db=createServiceRoleClient();
    const {data:allowed}=checked(await db.rpc('chat_rate_limit',{p_bucket:`webhook:${process.env.META_PAGE_ID}`,p_limit:300,p_seconds:60}));
    if(!allowed){await note('RATE_LIMITED',429,{entries:shape.entries,detail});return NextResponse.json({error:'RATE_LIMITED'},{status:429});}
    const rules=await getRules(db);
    if(events.length)checked(await db.rpc('chat_ingest_batch',{p_events:events,p_enabled:rules.enabled&&rules.mode!=='HUMAN'}));
    await note(events.length?'OK':'OK_NO_EVENTS',200,{entries:shape.entries,events:events.length,detail});
    return NextResponse.json({received:true});
  }catch(error){
    const code=error instanceof ChatError?error.code:'WEBHOOK_STORAGE_FAILED',status=error instanceof ChatError?error.status:503;
    await note('ERROR',status,{detail:code});
    return NextResponse.json({error:code},{status});
  }
}
