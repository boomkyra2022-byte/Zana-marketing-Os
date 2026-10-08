import { NextResponse } from 'next/server';
import { secureEqual } from '@/lib/ai-chat/meta';
import { runWorker } from '@/lib/ai-chat/worker';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request:Request) {
  const secret=process.env.AI_CHAT_WORKER_SECRET;
  if(!secret||!secureEqual(request.headers.get('authorization')||'',`Bearer ${secret}`))return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  try{
    const started=Date.now();const results=[];
    do { const result=await runWorker();results.push(result);if(!result.processed)break; }
    while(results.length<3&&Date.now()-started<20000);
    return NextResponse.json({results});
  }catch{return NextResponse.json({error:'WORKER_FAILED'},{status:503});}
}
