// Runs with existing TypeScript dependency; no additional production dependency.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const ts=require('typescript');const {createHmac}=require('node:crypto');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const core=require('../lib/ai-chat/core.ts');const meta=require('../lib/ai-chat/meta.ts');const {analyzeChat}=require('../lib/ai-chat/ai.ts');
const {checkOpenAIConnection}=require('../lib/ai-chat/ai.ts');const issues=require('../lib/ai-chat/issues.ts');
const analysis=(change={})=>({intent:'FAQ',product_id:null,purchase_intent:0,sentiment:'NEUTRAL',needs_human:false,confidence:0.9,answers:[],question:'NONE',memory:[],...change});
test('Hello: greeting reply and fast routing',()=>{assert.equal(core.preflight('Hello').intent,'GREETING');assert.equal(core.routeTier('Hello','GREETING'),'fast');assert.match(core.groundedReply(analysis({intent:'GREETING'}),[]),/สวัสดี/);});
test('Price: score 10, only approved current price snippet',()=>{assert.equal(core.preflight('ราคาเท่าไหร่').intent,'PRICE');assert.equal(core.scoreDelta('PRICE','ราคา',core.defaults),10);const source={id:'p',text:'ราคา 100 บาท',kind:'price',product_id:null};assert.ok(core.groundedReply(analysis({intent:'PRICE',answers:[{source_id:'p',quote:source.text}]}),[source]));assert.equal(core.groundedReply(analysis({intent:'PRICE',answers:[{source_id:'p',quote:'ราคา 10 บาท'}]}),[source]),null);});
test('Promotion: future and expired offers excluded, current accepted',()=>{const now=Date.parse('2026-10-07T00:00:00Z');assert.equal(core.activeAt({status:'active',starts_at:'2026-10-08T00:00:00Z'},now),false);assert.equal(core.activeAt({status:'active',ends_at:'2026-10-06T00:00:00Z'},now),false);assert.equal(core.activeAt({status:'inactive'},now),false);assert.equal(core.activeAt({status:'active'},now),true);assert.equal(core.preflight('มีโปรโมชั่นไหม').intent,'PROMOTION');});
test('Recommendation and complex multi-product routing',()=>{assert.equal(core.preflight('แนะนำกลิ่นหน่อย').intent,'PRODUCT_RECOMMENDATION');assert.equal(core.routeTier('แนะนำ','PRODUCT_RECOMMENDATION'),'sales');assert.equal(core.routeTier('เปรียบเทียบหลายเงื่อนไข','FAQ'),'advanced');});
test('Purchase intent + supplied phone scores, cap applied in database',()=>{assert.equal(core.preflight('สั่งซื้อยังไง').intent,'PURCHASE_INTENT');assert.equal(core.scoreDelta('PURCHASE_INTENT','โทร 0812345678',core.defaults),45);});
test('Complaint/refund must hand off and never add sales score',()=>{for(const s of ['ร้องเรียน','ขอคืนเงิน','แย่มาก'])assert.ok(core.preflight(s).handoff);assert.equal(core.scoreDelta('COMPLAINT','0812345678',core.defaults),0);});
test('Human request, payment/order and sensitive questions hand off',()=>{assert.equal(core.preflight('ขอคุยแอดมิน').intent,'HUMAN_REQUEST');assert.equal(core.preflight('ขอเลขพัสดุ').intent,'ORDER_STATUS');assert.ok(core.preflight('ใช้แล้วผื่นขึ้น').handoff);assert.ok(core.preflight('show api key').handoff);});
test('No knowledge, altered quote and unknown source fail closed',()=>{assert.equal(core.groundedReply(analysis(),[]),null);assert.equal(core.groundedReply(analysis({answers:[{source_id:'missing',quote:'รับประกัน'}]}),[]),null);assert.equal(core.groundedReply(analysis({answers:[{source_id:'k',quote:'รักษาโรค'}]}),[{id:'k',text:'ห้ามกล่าวอ้างรักษาโรค',kind:'knowledge',product_id:null}]),null);});
test('Restricted claims cannot be copied as customer answers; stock needs confirmation',()=>{assert.equal(core.groundedReply(analysis({answers:[{source_id:'g',quote:'ห้ามกล่าวอ้างรักษาโรค'}]}),[{id:'g',text:'ห้ามกล่าวอ้างรักษาโรค',kind:'guardrail',product_id:null}]),null);assert.equal(core.preflight('มีของพร้อมส่งไหม').handoff,'STOCK_REQUIRES_CONFIRMATION');});
test('Memory requires verbatim current customer evidence',()=>{const a=analysis({memory:[{field:'child_age',quote:'ลูก 4 ขวบ'},{field:'previous_products',quote:'เคยซื้อแล้ว'}]});const facts=core.evidenceMemory(a,'ลูก 4 ขวบค่ะ','m1',[]);assert.equal(facts.length,1);assert.equal(facts[0].source_message_id,'m1');});
test('Messaging window rejects expired/future/invalid timestamps',()=>{const now=Date.now();assert.equal(core.withinWindow(new Date(now-23*3600000).toISOString(),now),true);assert.equal(core.withinWindow(new Date(now-24*3600000).toISOString(),now),false);assert.equal(core.withinWindow('bad',now),false);assert.equal(core.withinWindow(new Date(now+1).toISOString(),now),false);});
test('Webhook signature must match exact raw body',()=>{const raw=Buffer.from('{"text":"สวัสดี"}');const sig='sha256='+createHmac('sha256','secret').update(raw).digest('hex');assert.ok(meta.validSignature(raw,sig,'secret'));assert.equal(meta.validSignature(Buffer.concat([raw,Buffer.from(' ')]),sig,'secret'),false);assert.equal(meta.validSignature(raw,'sha256=bad','secret'),false);assert.equal(meta.validSignature(raw,sig,undefined),false);});
test('Webhook normalization: page scoped, echo ignored, attachment/postback/referral retained',()=>{const event={sender:{id:'customer'},recipient:{id:'page'},timestamp:1780000000000,message:{mid:'m1',text:'hi',attachments:[{type:'image',payload:{url:'https://example.com/image'}}]},referral:{ad_id:'ad1'}};const payload={object:'page',entry:[{id:'page',messaging:[event,{...event,message:{mid:'echo',is_echo:true}},{...event,message:undefined,postback:{title:'เริ่ม',payload:'START'}}]},{id:'wrong',messaging:[event]}]};const rows=meta.receiveMessage(payload,'page');assert.equal(rows.length,2);assert.equal(rows[0].referral.ad_id,'ad1');assert.equal(rows[0].attachments.length,1);assert.ok(rows[1].mid.startsWith('postback:'));assert.deepEqual(meta.receiveMessage(payload,'page'),rows);});
test('Strict output rejects invalid confidence and unknown fields',()=>{assert.equal(core.analysisSchema.safeParse(analysis({confidence:2})).success,false);assert.equal(core.analysisSchema.safeParse(analysis({secret:'x'})).success,false);});
test('Meta HTTP errors and ambiguous timeout are distinguished',async()=>{const original=global.fetch;Object.assign(process.env,{META_PAGE_ID:'page',META_PAGE_ACCESS_TOKEN:'test-only',META_MESSENGER_API_VERSION:'v1.0'});try{global.fetch=async()=>new Response('{}',{status:400});await assert.rejects(()=>new meta.MetaMessengerService().sendMessage('customer','hi'),e=>e.code==='META_HTTP_400'&&!e.uncertain);global.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};await assert.rejects(()=>new meta.MetaMessengerService().sendMessage('customer','hi'),e=>e.uncertain);global.fetch=async()=>new Response('{"message_id":"sent1"}');assert.equal(await new meta.MetaMessengerService().sendMessage('customer','hi'),'sent1');}finally{global.fetch=original;}});
test('OpenAI timeout/refusal/invalid output fails closed, request stores no chat',async()=>{const original=global.fetch;process.env.OPENAI_API_KEY='test-only';const context={text:'hi',history:[],summary:'',memory:[],sources:[]};try{global.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};await assert.rejects(()=>analyzeChat('test-model',context),/OPENAI_TIMEOUT/);global.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.temperature,undefined);return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'refusal'}]}]}));};await assert.rejects(()=>analyzeChat('test-model',context),/OPENAI_REFUSAL/);global.fetch=async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(analysis({intent:'GREETING'}))}]}],usage:{input_tokens:10,output_tokens:5}}));const result=await analyzeChat('test-model',context);assert.equal(result.input,10);assert.equal(result.analysis.intent,'GREETING');}finally{global.fetch=original;}});

test('OpenAI diagnostics preserves specific auth/quota causes without provider text',()=>{
  assert.equal(issues.openAIErrorCode(401,{error:{code:'invalid_api_key',message:'secret-value'}}),'OPENAI_INVALID_API_KEY');
  assert.equal(issues.openAIErrorCode(401,{error:{code:'ip_not_authorized'}}),'OPENAI_IP_NOT_AUTHORIZED');
  assert.equal(issues.openAIErrorCode(429,{error:{code:'insufficient_quota'}}),'OPENAI_QUOTA_EXCEEDED');
  assert.equal(issues.openAIErrorCode(429,{error:{code:'rate_limit_exceeded'}}),'OPENAI_RATE_LIMITED');
  assert.equal(issues.openAIErrorCode(404,{error:{code:'model_not_found'}}),'OPENAI_MODEL_NOT_FOUND');
  assert.equal(issues.openAIErrorCode(401,{error:{code:'secret-value'}}),'OPENAI_HTTP_401');
  assert.doesNotMatch(issues.describeChatIssue('OPENAI_INVALID_API_KEY'),/secret-value/);
});
test('Readable setup exception never permits writes, other views, or database authorization errors',()=>{
  const req=new Request('https://example.com/api/ai-chat?view=setup');const missing={code:'PGRST202'};
  assert.equal(issues.canReadSetupWithoutMigration(req,false,true,missing),true);
  assert.equal(issues.canReadSetupWithoutMigration(req,true,true,missing),false);
  assert.equal(issues.canReadSetupWithoutMigration(req,false,false,missing),false);
  assert.equal(issues.canReadSetupWithoutMigration(req,false,true,{code:'42501'}),false);
  assert.equal(issues.canReadSetupWithoutMigration(new Request(req.url,{method:'POST'}),false,true,missing),false);
  assert.equal(issues.canReadSetupWithoutMigration(new Request('https://example.com/api/ai-chat?view=inbox'),false,true,missing),false);
  assert.equal(issues.canReadSetupWithoutMigration(new Request('https://example.com/other?view=setup'),false,true,missing),false);
});
test('Missing OpenAI key makes no external request',async()=>{
  const original=global.fetch,key=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
  try{global.fetch=async()=>{throw new Error('must not fetch');};const result=await checkOpenAIConnection();assert.equal(result.code,'AI_NOT_CONFIGURED');assert.equal(result.ok,false);}finally{global.fetch=original;if(key!==undefined)process.env.OPENAI_API_KEY=key;}
});
test('OpenAI auth diagnostic is read-only and distinguishes auth from model capability',async()=>{
  const original=global.fetch;process.env.OPENAI_API_KEY='test-only';
  try{global.fetch=async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/models');assert.equal(opts.body,undefined);assert.equal(opts.method,undefined);return new Response('{"data":[]}');};const result=await checkOpenAIConnection();assert.equal(result.ok,true);assert.equal(result.scope,'authentication');assert.match(result.message,/ยังต้องทดสอบ/);}finally{global.fetch=original;}
});
test('Diagnostic 401 returns safe Thai message, never leaked provider credentials',async()=>{
  const original=global.fetch;process.env.OPENAI_API_KEY='test-only';
  try{global.fetch=async()=>new Response(JSON.stringify({error:{code:'invalid_api_key',message:'Incorrect key sk-secret-value'}}),{status:401});const result=await checkOpenAIConnection();assert.equal(result.code,'OPENAI_INVALID_API_KEY');assert.equal(result.ok,false);assert.doesNotMatch(JSON.stringify(result),/sk-secret-value/);}finally{global.fetch=original;}
});
test('Diagnostic timeout and malformed 200 response do not show a success status',async()=>{
  const original=global.fetch;process.env.OPENAI_API_KEY='test-only';
  try{global.fetch=async()=>{throw new Error('network');};assert.equal((await checkOpenAIConnection()).ok,false);global.fetch=async()=>new Response('<html>unavailable</html>');assert.equal((await checkOpenAIConnection()).code,'OPENAI_INVALID_RESPONSE');}finally{global.fetch=original;}
});
test('Actual generation retains specific invalid_api_key cause for human handoff',async()=>{
  const original=global.fetch;process.env.OPENAI_API_KEY='test-only';
  try{global.fetch=async()=>new Response(JSON.stringify({error:{code:'invalid_api_key',message:'sk-secret-value'}}),{status:401});await assert.rejects(()=>analyzeChat('test-model',{text:'hello',history:[],summary:'',memory:[],sources:[]}),e=>e.message==='OPENAI_INVALID_API_KEY');}finally{global.fetch=original;}
});

const SECRET_TEXT='SECRET CUSTOMER MESSAGE';
test('Webhook diagnostics describe payload SHAPE for a real message without leaking content',()=>{
  const real={object:'page',entry:[{id:'111',time:1,messaging:[{sender:{id:'u1'},recipient:{id:'111'},timestamp:1,message:{mid:'m1',text:SECRET_TEXT}}]}]};
  const shape=meta.describeEnvelope(real,'111');
  assert.deepEqual(shape,{entries:1,pageMatch:true,entryIds:['111'],entryKeys:['messaging'],eventKinds:['message']});
  assert.ok(!meta.formatEnvelope(shape).includes(SECRET_TEXT));
  assert.equal(meta.formatEnvelope(shape),'ids=111; page_match=true; entry_keys=messaging; kinds=message');
});
test('Webhook diagnostics tell the dashboard Test shape, standby delivery, delivery/read and a wrong Page apart',()=>{
  const dash=meta.describeEnvelope({object:'page',entry:[{id:'0',time:1,changes:[{field:'messages',value:{message:{text:SECRET_TEXT}}}]}]},'111');
  assert.deepEqual([dash.pageMatch,dash.entryIds,dash.entryKeys,dash.eventKinds],[false,['0'],['changes'],['changes:messages']]);
  // Secondary receiver (another app owns the thread): events arrive under `standby`, not `messaging`.
  const standby=meta.describeEnvelope({object:'page',entry:[{id:'111',time:1,standby:[{sender:{id:'u'},recipient:{id:'111'},timestamp:1,message:{mid:'m',text:SECRET_TEXT}}]}]},'111');
  assert.deepEqual([standby.pageMatch,standby.entryKeys,standby.eventKinds],[true,['standby'],['message']]);
  const receipts=meta.describeEnvelope({object:'page',entry:[{id:'111',messaging:[{sender:{id:'u'},recipient:{id:'111'},timestamp:1,delivery:{}},{sender:{id:'u'},recipient:{id:'111'},timestamp:2,read:{}}]}]},'111');
  assert.deepEqual(receipts.eventKinds,['delivery','read']);
  assert.equal(meta.describeEnvelope({object:'page',entry:[{id:'222',messaging:[]}]},'111').pageMatch,false);
});
test('Webhook diagnostics never throw on malformed payloads',()=>{
  for(const bad of [null,undefined,'text',42,[],{},{entry:'no'},{entry:[null,5,'x',{}]}]) assert.doesNotThrow(()=>meta.describeEnvelope(bad,'111'));
  assert.equal(meta.describeEnvelope({entry:[null,5,'x']},'111').pageMatch,false);
});
test('Webhook parse errors are summarized by schema path/code and never quote the body',()=>{
  let schemaErr;try{meta.receiveMessage({object:'page',entry:[{id:5}]},'111');}catch(e){schemaErr=e;}
  assert.match(meta.describeParseError(schemaErr),/entry\.0\.id:invalid_type/);
  let jsonErr;try{JSON.parse('{"text":"'+SECRET_TEXT+'" oops');}catch(e){jsonErr=e;}
  assert.equal(meta.describeParseError(jsonErr),'PARSE_ERROR');
  assert.ok(!meta.describeParseError(jsonErr).includes(SECRET_TEXT));
  let tsErr;try{meta.receiveMessage({object:'page',entry:[{id:'111',messaging:[{sender:{id:'u'},recipient:{id:'111'},message:{mid:'m',text:'x'}}]}]},'111');}catch(e){tsErr=e;}
  assert.equal(meta.describeParseError(tsErr),'MISSING_TIMESTAMP');
});

// Optional real Postgres-in-WASM integration suite. Set PGLITE_MODULE to an external QA installation.
test('Migration + queue + takeover + scoring + RLS integration', {skip:!process.env.PGLITE_MODULE},async t=>{
  const {PGlite}=require(process.env.PGLITE_MODULE);const db=new PGlite();
  const operator='00000000-0000-4000-8000-000000000001';
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table profiles(id uuid primary key,role text,status text);insert into profiles values('${operator}','owner','approved');
    create table products(id uuid primary key,product_name text);create table settings(key text primary key,value jsonb);
    alter table settings enable row level security;create policy legacy_settings on settings for all to authenticated using(true) with check(true);
    grant all on settings to authenticated;grant select on profiles to authenticated;
    insert into settings values('ai_chat','{}'),('ai','{}');
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/0029_ai_sales_chat.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/0030_chat_webhook_events.sql'),'utf8'));
  const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  const ingest=async(sender,mid,text='hello')=>scalar('select chat_ingest($1::jsonb,true)',[JSON.stringify({page_id:'page',sender_id:sender,mid,text,timestamp:new Date().toISOString(),attachments:[]})]);
  const claim=()=>scalar('select chat_claim()');
  const finish=j=>scalar('select chat_finish($1,$2,null)',[j.id,j.lease_token]);
  const control=(conv,action,request=null)=>scalar('select chat_control($1,$2,$3,null,$4,$5)',[conv,action,operator,action==='send'?'admin reply':null,request]);
  const analyze=(j,revision,extra={})=>scalar('select chat_analyze($1,$2,$3,$4::jsonb)',[j.id,j.lease_token,revision,JSON.stringify({intent:'PRICE',confidence:1,score_delta:10,summary:'exact customer text',facts:[],reply:'approved reply',threshold:80,...extra})]);
  try{
    await t.test('Duplicate webhook produces one customer, message and job',async()=>{const first=await ingest('a','mid-a');assert.ok(first);assert.equal(await ingest('a','mid-a'),null);assert.equal(Number(await scalar('select count(*) from chat_messages')),1);assert.equal(Number(await scalar('select count(*) from chat_jobs')),1);});
    let first=await claim();let conv=first.conversation_id;
    await t.test('Conversation lease excludes concurrent claim',async()=>{assert.equal(await claim(),null);});
    await t.test('Take Over invalidates in-flight AI generation',async()=>{await control(conv,'takeover');assert.equal(await analyze(first,1),false);assert.equal(await scalar('select status from chat_conversations where id=$1',[conv]),'HUMAN_ACTIVE');assert.equal(Number(await scalar("select count(*) from chat_messages where sender_type='AI'")),0);await finish(first);});
    await t.test('Return to AI resumes subsequent message',async()=>{await control(conv,'return');await ingest('a','mid-a2');const j=await claim();const revision=await scalar('select revision from chat_conversations where id=$1',[conv]);assert.equal(await analyze(j,revision),true);assert.equal(await analyze(j,revision),false);await finish(j);const outgoing=await claim();assert.equal(outgoing.kind,'outbound');assert.equal(await scalar('select chat_reserve_send($1,$2,true)',[outgoing.id,outgoing.lease_token]),true);assert.equal(await scalar('select chat_reserve_send($1,$2,true)',[outgoing.id,outgoing.lease_token]),false);await db.query("update chat_messages set delivery_status='sent' where id=$1",[outgoing.message_id]);await finish(outgoing);});
    await t.test('High lead score caps at 100 and hands off',async()=>{await db.query('update chat_customers set lead_score=95 where id=(select customer_id from chat_conversations where id=$1)',[conv]);await ingest('a','mid-a3');const j=await claim();const rev=await scalar('select revision from chat_conversations where id=$1',[conv]);assert.equal(await analyze(j,rev,{score_delta:25}),false);assert.equal(await scalar('select lead_score from chat_customers where id=(select customer_id from chat_conversations where id=$1)',[conv]),100);assert.equal(await scalar('select status from chat_conversations where id=$1',[conv]),'WAITING_ADMIN');await finish(j);});
    await t.test('Admin send has durable idempotency and takeover prerequisite',async()=>{await assert.rejects(()=>control(conv,'send',operator),/TAKE_OVER_REQUIRED/);await control(conv,'takeover');await control(conv,'send',operator);await control(conv,'send',operator);assert.equal(Number(await scalar("select count(*) from chat_messages where sender_type='ADMIN'")),1);const j=await claim();await control(conv,'close');assert.equal(await scalar('select chat_reserve_send($1,$2,true)',[j.id,j.lease_token]),false);await finish(j);});
    await t.test('Expired admin reply blocked by database',async()=>{await control(conv,'takeover');await db.query("update chat_conversations set last_customer_message_at=now()-interval '25 hours' where id=$1",[conv]);await assert.rejects(()=>control(conv,'send','00000000-0000-4000-8000-000000000002'),/WINDOW_EXPIRED/);});
    await t.test('Shared rate limiter persists across requests',async()=>{assert.equal(await scalar("select chat_rate_limit('test',1,60)"),true);assert.equal(await scalar("select chat_rate_limit('test',1,60)"),false);});
    await t.test('RLS denies pending users and direct browser mutations/RPC',async()=>{await db.exec(`insert into profiles values('00000000-0000-4000-8000-000000000003','owner','pending');set role authenticated;set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';`);assert.equal(Number(await scalar('select count(*) from chat_customers')),0);await assert.rejects(()=>db.exec("insert into chat_customers(page_id,external_customer_id) values('x','x')"),/permission denied/);await assert.rejects(()=>db.exec('select chat_claim()'),/permission denied/);await db.exec(`set request.jwt.claim.sub='${operator}';`);assert.equal(Number(await scalar('select count(*) from chat_customers')),1);await db.exec('reset role');});
    await t.test('New settings restriction protects chat key without changing older settings',async()=>{await db.exec("set role authenticated;set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';");assert.equal(Number(await scalar("select count(*) from settings where key='ai_chat'")),0);assert.equal(Number(await scalar("select count(*) from settings where key='ai'")),1);await db.exec(`set request.jwt.claim.sub='${operator}';`);assert.equal(Number(await scalar("select count(*) from settings where key='ai_chat'")),1);await db.exec('reset role');});
    await t.test('Stale sending becomes uncertain and is not resent',async()=>{await ingest('b','mid-b');const j=await claim();const rev=await scalar('select revision from chat_conversations where id=$1',[j.conversation_id]);await analyze(j,rev);await finish(j);const out=await claim();await scalar('select chat_reserve_send($1,$2,true)',[out.id,out.lease_token]);await db.query("update chat_jobs set locked_at=now()-interval '3 minutes' where id=$1",[out.id]);await db.query("update chat_conversations set lease_until=now()-interval '1 minute' where id=$1",[out.conversation_id]);assert.equal(await claim(),null);assert.equal(await scalar('select delivery_status from chat_messages where id=$1',[out.message_id]),'uncertain');assert.equal(await scalar('select state from chat_jobs where id=$1',[out.id]),'failed');});
    await t.test('Webhook diagnostics: caps anonymous outcomes, truncates, and stays service-only',async()=>{
      const log=(o,s=200,d=null)=>scalar('select chat_log_webhook($1,$2,10,true,$3,1,0,$4)',[o,s,'facebookexternalua',d]);
      const count=o=>scalar('select count(*) from chat_webhook_events where outcome=$1',[o]).then(Number);
      for(let i=0;i<25;i++) await log('INVALID_SIGNATURE',401);
      assert.equal(await count('INVALID_SIGNATURE'),10,'unauthenticated outcome must be capped per minute');
      for(let i=0;i<25;i++) await log('OK',200,'ids=111; page_match=true');
      assert.equal(await count('OK'),25,'validly signed outcomes are never capped');
      await log('Y'.repeat(100),200,'d'.repeat(900));
      assert.equal(await scalar("select max(length(outcome)) from chat_webhook_events where outcome like 'YYY%'"),40);
      assert.equal(await scalar("select max(length(detail)) from chat_webhook_events"),500);
      await db.exec("insert into profiles values('00000000-0000-4000-8000-000000000004','viewer','approved') on conflict do nothing;set role authenticated;set request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';");
      assert.equal(Number(await scalar('select count(*) from chat_webhook_events')),0,'non-operators cannot read diagnostics');
      await db.exec(`set request.jwt.claim.sub='${operator}';`);
      assert.ok(Number(await scalar('select count(*) from chat_webhook_events'))>0,'operators can read diagnostics');
      await assert.rejects(()=>db.exec("insert into chat_webhook_events(outcome) values('x')"),/permission denied/);
      await assert.rejects(()=>db.exec("select chat_log_webhook('x',1,1,true,'ua',1,1,'d')"),/permission denied/);
      await db.exec('reset role');
    });
    await t.test('Analytics aggregate executes and does not fabricate revenue',async()=>{const a=await scalar('select chat_analytics()');assert.equal(a.total,2);assert.equal('revenue' in a,false);});
  }finally{await db.close();}
});
