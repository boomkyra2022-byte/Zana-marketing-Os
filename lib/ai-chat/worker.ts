import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checked, getRules, knowledge } from './server';
import { evidenceMemory, groundedReply, preflight, routeTier, scoreDelta, withinWindow, type Analysis, type Source } from './core';
import { analyzeChat } from './ai';
import { MetaError, MetaMessengerService } from './meta';

export async function runWorker() {
  const db=createServiceRoleClient();const {data:job}=checked(await db.rpc('chat_claim'));
  if(!job)return {processed:0};
  const finish=async(error:string|null=null)=>checked(await db.rpc('chat_finish',{p_job:job.id,p_token:job.lease_token,p_error:error}));
  let sendStarted=false;
  try {
    const {data:c}=checked(await db.from('chat_conversations').select('*,customer:chat_customers(*)').eq('id',job.conversation_id).single());
    const {data:m}=checked(await db.from('chat_messages').select('*').eq('id',job.message_id).single());
    const rules=await getRules(db);
    if(job.kind==='outbound') {
      if(c.channel!=='facebook'||c.customer.page_id!==process.env.META_PAGE_ID)throw new MetaError('META_PAGE_MISMATCH');
      if(m.sender_type==='AI'&&m.grounding?.length) {
        const currentSources=await knowledge(db,m.message,m.product_id);
        if(!m.grounding.every((s:Source)=>currentSources.some(current=>current.id===s.id&&current.text===s.text)))throw new Error('AI_KNOWLEDGE_CHANGED');
      }
      const {data:reserved}=checked(await db.rpc('chat_reserve_send',{p_job:job.id,p_token:job.lease_token,p_enabled:rules.enabled&&rules.mode!=='HUMAN'}));
      if(!reserved){await finish();return {processed:1,cancelled:true};}
      // Database reservation is the last step before dispatch; already-dispatched requests cannot be recalled.
      sendStarted=true;
      const providerId=await new MetaMessengerService().sendMessage(c.customer.external_customer_id,m.message);
      checked(await db.from('chat_messages').update({delivery_status:'sent',sent_at:new Date().toISOString(),external_message_id:providerId,response_ms:Math.max(0,Date.now()-Date.parse(c.last_customer_message_at))}).eq('id',m.id));
      checked(await db.from('chat_conversations').update({last_message_at:new Date().toISOString()}).eq('id',c.id));
      await finish();return {processed:1,sent:true};
    }
    if(m.intent){await finish();return {processed:1};}
    const [{data:history},{data:memory}]=await Promise.all([
      db.from('chat_messages').select('id,message,sender_type,created_at,product_id').eq('conversation_id',c.id).in('sender_type',['CUSTOMER','AI','ADMIN']).lte('created_at',m.created_at).order('created_at',{ascending:false}).limit(12).then(checked),
      db.from('chat_customer_memory').select('facts,last_summary').eq('customer_id',c.customer_id).single().then(checked)
    ]);
    const gate=preflight(m.message);
    let handoff=gate.handoff,model:string|null=null,input=0,output=0,reply:string|null=null,cost:number|null=null;
    let replySources:Source[]=[];
    let analysis:Analysis={intent:gate.intent,product_id:null,purchase_intent:0,sentiment:'NEUTRAL',needs_human:!!handoff,confidence:1,answers:[],question:'NONE',memory:[]};
    if(!withinWindow(c.last_customer_message_at))handoff='WINDOW_EXPIRED';
    if(m.attachments?.length||!m.message.trim()||m.message.length>4000)handoff=handoff||'ATTACHMENT_OR_UNSUPPORTED_MESSAGE';
    const automated=rules.enabled&&rules.mode!=='HUMAN'&&c.ai_enabled&&c.status==='AI_ACTIVE';
    if(automated&&!handoff) {
      const sources=await knowledge(db,m.message,history?.find((x:any)=>x.product_id)?.product_id||null);
      if(!sources.length&&gate.intent!=='GREETING') handoff='NO_APPROVED_KNOWLEDGE';
      else {
        const tier=routeTier(m.message,gate.intent);
        const {data:legacy}=checked(await db.from('settings').select('value').eq('key','ai').maybeSingle());
        model=rules[`${tier}_model`]||process.env[`CHAT_${tier.toUpperCase()}_MODEL`]||legacy?.value?.model||process.env.AI_MODEL||'';
        const result=await analyzeChat(model||'',{text:m.message,history:(history||[]).reverse().map((h:any)=>({sender:h.sender_type,text:h.message.slice(0,1500)})),summary:memory?.last_summary||'',memory:memory?.facts||[],sources});
        analysis=result.analysis;input=result.input;output=result.output;
        if(analysis.product_id&&!sources.some(s=>s.product_id===analysis.product_id))throw new Error('AI_UNKNOWN_PRODUCT');
        reply=groundedReply(analysis,sources);
        replySources=sources.filter(source=>analysis.answers.some(answer=>answer.source_id===source.id));
        const rates=rules.pricing[model||''];if(rates)cost=(input*rates.input+output*rates.output)/1e6;
        if(analysis.needs_human||analysis.sentiment==='NEGATIVE'||['COMPLAINT','ORDER_STATUS','HUMAN_REQUEST'].includes(analysis.intent))handoff='AI_REQUESTED_HANDOFF';
        else if(analysis.confidence<rules.confidence_threshold)handoff='LOW_CONFIDENCE';
        else if(!reply)handoff='UNSUPPORTED_ANSWER';
      }
    }
    if(!automated&&!handoff&&c.status==='AI_ACTIVE')handoff='AI_DISABLED';
    // Extractive summary: verbatim customer evidence, bounded cost and no fabricated facts.
    const summary=[...(history||[])].sort((a:any,b:any)=>Date.parse(a.created_at)-Date.parse(b.created_at)).filter((h:any)=>h.sender_type==='CUSTOMER').slice(-6).map((h:any)=>h.message.slice(0,180)).join('\n');
    checked(await db.rpc('chat_analyze',{p_job:job.id,p_token:job.lease_token,p_revision:c.revision,p_result:{
      intent:analysis.intent,product_id:analysis.product_id,confidence:analysis.confidence,purchase_intent:analysis.purchase_intent,sentiment:analysis.sentiment,model,input_tokens:input,output_tokens:output,cost,
      score_delta:handoff?0:scoreDelta(analysis.intent,m.message,rules),facts:evidenceMemory(analysis,m.message,m.id,memory?.facts||[]),summary,
      handoff,reply:automated?reply:null,reply_sources:replySources,threshold:rules.handoff_threshold
    }}));
    await finish();return {processed:1,handoff:!!handoff};
  } catch(error) {
    const code=error instanceof MetaError?error.code:error instanceof Error&&/^(OPENAI_|AI_|CHAT_)/.test(error.message)?error.message:'CHAT_PROCESSING_FAILED';
    if(sendStarted) {
      checked(await db.from('chat_messages').update({delivery_status:error instanceof MetaError&&!error.uncertain?'failed':'uncertain',error_code:code}).eq('id',job.message_id).eq('delivery_status','sending'));
    } else if(job.kind==='outbound') {
      checked(await db.from('chat_messages').update({delivery_status:'failed',error_code:code}).eq('id',job.message_id).eq('delivery_status','queued'));
    }
    checked(await db.from('chat_conversations').update({status:'WAITING_ADMIN',ai_enabled:false,handoff_reason:code}).eq('id',job.conversation_id).eq('status','AI_ACTIVE'));
    await finish(code);
    return {processed:1,error:code};
  }
}
