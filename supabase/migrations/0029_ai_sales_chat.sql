-- Additive Messenger MVP. Apply after existing migrations through 0028.
begin;
create table public.chat_customers (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'facebook', page_id text not null, external_customer_id text not null,
  first_name text, last_name text, phone text, email text, tags text[] not null default '{}',
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  customer_stage text not null default 'NEW' check (customer_stage in ('NEW','INTERESTED','WARM','HOT','CUSTOMER','REPEAT')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(channel,page_id,external_customer_id)
);
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.chat_customers(id),
  channel text not null default 'facebook', external_conversation_id text not null,
  status text not null default 'WAITING_ADMIN' check(status in ('AI_ACTIVE','HUMAN_ACTIVE','WAITING_ADMIN','CLOSED')),
  assigned_admin_id uuid references public.profiles(id), ai_enabled boolean not null default false,
  revision integer not null default 0, handoff_reason text, handoff_count integer not null default 0,
  summary text not null default '', referral jsonb, started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(), last_customer_message_at timestamptz not null default now(),
  closed_at timestamptz, lease_until timestamptz, unique(customer_id)
);
create index chat_conversations_inbox on public.chat_conversations(status,last_message_at desc);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.chat_conversations(id),
  sender_type text not null check(sender_type in ('CUSTOMER','AI','ADMIN','SYSTEM')),
  message text not null default '', external_message_id text, attachments jsonb not null default '[]', postback jsonb,
  intent text, product_id uuid references public.products(id), ai_model text, ai_confidence numeric,
  purchase_intent numeric check(purchase_intent between 0 and 1), sentiment text, lead_score_delta integer not null default 0,
  admin_id uuid references public.profiles(id), grounding jsonb not null default '[]',
  input_tokens integer not null default 0, output_tokens integer not null default 0, estimated_cost_usd numeric,
  delivery_status text not null default 'received' check(delivery_status in ('received','queued','sending','sent','failed','uncertain','cancelled')),
  error_code text, response_ms integer, created_at timestamptz not null default now(), sent_at timestamptz,
  unique(conversation_id,external_message_id)
);
create index chat_messages_history on public.chat_messages(conversation_id,created_at desc);
create table public.chat_customer_memory (
  customer_id uuid primary key references public.chat_customers(id),
  facts jsonb not null default '[]', notes text not null default '', last_summary text not null default '',
  updated_at timestamptz not null default now()
);
create table public.chat_product_knowledge (
  product_id uuid primary key references public.products(id),
  age_requirement text not null default '', faq text not null default '', restrictions text not null default '',
  upsell text not null default '', cross_sell text not null default '',
  approved boolean not null default false, updated_at timestamptz not null default now()
);
create table public.chat_jobs (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.chat_conversations(id),
  message_id uuid not null references public.chat_messages(id), kind text not null check(kind in ('incoming','outbound')),
  state text not null default 'pending' check(state in ('pending','processing','done','failed','cancelled')),
  attempts integer not null default 0, lease_token uuid, available_at timestamptz not null default now(),
  locked_at timestamptz, error_code text, created_at timestamptz not null default now(), unique(message_id,kind)
);
create index chat_jobs_pending on public.chat_jobs(state,available_at,created_at);
create table public.chat_rate_limits (bucket text primary key, hits integer not null, expires_at timestamptz not null);

create function public.chat_operator() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles where id=auth.uid() and status='approved' and role in ('owner','admin','content_lead'));
$$;
revoke all on function public.chat_operator() from public,anon;
grant execute on function public.chat_operator() to authenticated,service_role;
-- Existing settings policies are broad; constrain only this new key, preserving every older setting.
create policy ai_chat_settings_approved on public.settings as restrictive for all to authenticated
  using (key <> 'ai_chat' or public.chat_operator())
  with check (key <> 'ai_chat' or exists(select 1 from public.profiles where id=auth.uid() and status='approved' and role in ('owner','admin')));
do $$ declare t text; begin
  foreach t in array array['chat_customers','chat_conversations','chat_messages','chat_customer_memory','chat_product_knowledge','chat_jobs','chat_rate_limits'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    if t <> 'chat_rate_limits' then
      execute format('grant select on public.%I to authenticated',t);
      execute format('create policy chat_read on public.%I for select to authenticated using (public.chat_operator())',t);
    end if;
  end loop;
end $$;

create function public.chat_rate_limit(p_bucket text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare n integer; begin
  insert into chat_rate_limits values(p_bucket,1,now()+make_interval(secs=>p_seconds))
  on conflict(bucket) do update set hits=case when chat_rate_limits.expires_at<=now() then 1 else chat_rate_limits.hits+1 end,
    expires_at=case when chat_rate_limits.expires_at<=now() then excluded.expires_at else chat_rate_limits.expires_at end returning hits into n;
  delete from chat_rate_limits where expires_at < now()-interval '1 day';
  return n<=p_limit;
end $$;

-- One transaction: rollback everything if persistence fails. Never acknowledge an unpersisted message.
create function public.chat_ingest(p_event jsonb,p_enabled boolean) returns uuid
language plpgsql security definer set search_path=public as $$
declare customer uuid; conv uuid; msg uuid; t timestamptz; begin
  t:=least((p_event->>'timestamp')::timestamptz,now());
  insert into chat_customers(channel,page_id,external_customer_id) values('facebook',p_event->>'page_id',p_event->>'sender_id')
  on conflict(channel,page_id,external_customer_id) do update set updated_at=now() returning id into customer;
  insert into chat_conversations(customer_id,external_conversation_id,status,ai_enabled,last_customer_message_at,last_message_at)
    values(customer,(p_event->>'page_id')||':'||(p_event->>'sender_id'),case when p_enabled then 'AI_ACTIVE' else 'WAITING_ADMIN' end,p_enabled,t,t)
    on conflict(customer_id) do nothing;
  select id into conv from chat_conversations where customer_id=customer for update;
  insert into chat_messages(conversation_id,sender_type,message,external_message_id,attachments,postback,created_at)
    values(conv,'CUSTOMER',coalesce(p_event->>'text',''),p_event->>'mid',coalesce(p_event->'attachments','[]'),p_event->'postback',t)
    on conflict(conversation_id,external_message_id) do nothing returning id into msg;
  if msg is null then return null; end if;
  update chat_conversations set last_message_at=greatest(last_message_at,t),last_customer_message_at=greatest(last_customer_message_at,t),
    referral=coalesce(p_event->'referral',referral),revision=revision+1,
    status=case when status='CLOSED' then case when ai_enabled and p_enabled then 'AI_ACTIVE' else 'WAITING_ADMIN' end else status end,
    closed_at=null where id=conv;
  insert into chat_customer_memory(customer_id) values(customer) on conflict do nothing;
  insert into chat_jobs(conversation_id,message_id,kind) values(conv,msg,'incoming');
  return msg;
end $$;

create function public.chat_ingest_batch(p_events jsonb,p_enabled boolean) returns integer
language plpgsql security definer set search_path=public as $$
declare event jsonb; accepted integer:=0; begin
  for event in select value from jsonb_array_elements(p_events) loop
    if chat_ingest(event,p_enabled) is not null then accepted:=accepted+1; end if;
  end loop;
  return accepted;
end $$;

-- Reserve one conversation at a time. An expired lease reclaims generation, never an uncertain send.
create function public.chat_claim() returns jsonb language plpgsql security definer set search_path=public as $$
declare j chat_jobs; c uuid; token uuid:=gen_random_uuid(); begin
  update chat_messages set delivery_status='uncertain',error_code='DELIVERY_UNKNOWN'
    where delivery_status='sending' and id in(select message_id from chat_jobs where state='processing' and locked_at<now()-interval '2 minutes');
  update chat_conversations set status='WAITING_ADMIN',ai_enabled=false,handoff_reason='DELIVERY_UNKNOWN',revision=revision+1
    where id in(select conversation_id from chat_messages where delivery_status='uncertain') and status='AI_ACTIVE';
  update chat_jobs set state='failed',error_code='DELIVERY_UNKNOWN' where state='processing' and message_id in(select id from chat_messages where delivery_status='uncertain');
  update chat_jobs set state='failed',error_code='WORKER_INTERRUPTED' where state='processing' and locked_at<now()-interval '2 minutes' and attempts>=3;
  update chat_messages set delivery_status='failed',error_code='WORKER_INTERRUPTED'
    where delivery_status='queued' and id in(select message_id from chat_jobs where state='failed' and error_code='WORKER_INTERRUPTED');
  update chat_conversations set status='WAITING_ADMIN',ai_enabled=false,handoff_reason='WORKER_INTERRUPTED',revision=revision+1
    where status='AI_ACTIVE' and id in(select conversation_id from chat_jobs where state='failed' and error_code='WORKER_INTERRUPTED');
  select cv.id into c from chat_conversations cv where (cv.lease_until is null or cv.lease_until<now())
    and exists(select 1 from chat_jobs q where q.conversation_id=cv.id and ((q.state='pending' and q.available_at<=now()) or (q.state='processing' and q.locked_at<now()-interval '2 minutes' and q.attempts<3)))
    order by cv.last_message_at for update skip locked limit 1;
  if c is null then return null; end if;
  select * into j from chat_jobs where conversation_id=c and ((state='pending' and available_at<=now()) or (state='processing' and locked_at<now()-interval '2 minutes' and attempts<3))
    order by created_at,id for update skip locked limit 1;
  update chat_conversations set lease_until=now()+interval '2 minutes' where id=c;
  update chat_jobs set state='processing',locked_at=now(),attempts=attempts+1,lease_token=token where id=j.id returning * into j;
  return to_jsonb(j);
end $$;

create function public.chat_finish(p_job uuid,p_token uuid,p_error text default null) returns void
language plpgsql security definer set search_path=public as $$
declare c uuid; begin
  select conversation_id into c from chat_jobs where id=p_job;
  perform 1 from chat_conversations where id=c for update;
  update chat_jobs set state=case when p_error is null then 'done' else 'failed' end,error_code=p_error
    where id=p_job and lease_token=p_token and state='processing' returning conversation_id into c;
  if c is not null then update chat_conversations set lease_until=null where id=c; end if;
end $$;

-- Mode controls and outbound admin enqueue share the conversation lock with AI finalize/reservation.
create function public.chat_control(p_id uuid,p_action text,p_actor uuid,p_assignee uuid default null,p_text text default null,p_request uuid default null) returns void
language plpgsql security definer set search_path=public as $$
declare c chat_conversations; m uuid; begin
  if not exists(select 1 from profiles where id=p_actor and status='approved' and role in ('owner','admin','content_lead')) then raise exception 'FORBIDDEN'; end if;
  select * into strict c from chat_conversations where id=p_id for update;
  if p_action='send' then
    if c.status<>'HUMAN_ACTIVE' then raise exception 'TAKE_OVER_REQUIRED'; end if;
    if c.last_customer_message_at<now()-interval '24 hours' then raise exception 'WINDOW_EXPIRED'; end if;
    if length(trim(p_text)) not between 1 and 1800 or p_request is null then raise exception 'INVALID_MESSAGE'; end if;
    insert into chat_messages(conversation_id,sender_type,message,external_message_id,delivery_status,admin_id)
      values(p_id,'ADMIN',p_text,'admin:'||p_request,'queued',p_actor) on conflict(conversation_id,external_message_id) do nothing returning id into m;
    if m is not null then insert into chat_jobs(conversation_id,message_id,kind) values(p_id,m,'outbound'); end if;
    return;
  elsif p_action='assign' then
    if p_assignee is not null and not exists(select 1 from profiles where id=p_assignee and status='approved' and role in ('owner','admin','content_lead')) then raise exception 'INVALID_ASSIGNEE'; end if;
    update chat_conversations set assigned_admin_id=p_assignee where id=p_id;
  elsif p_action in ('takeover','off','return','close') then
    update chat_conversations set status=case p_action when 'takeover' then 'HUMAN_ACTIVE' when 'return' then 'AI_ACTIVE' when 'close' then 'CLOSED' else 'WAITING_ADMIN' end,
      ai_enabled=(p_action='return'),revision=revision+1,closed_at=case when p_action='close' then now() else null end,
      assigned_admin_id=case when p_action='takeover' then p_actor else assigned_admin_id end,
      handoff_reason=case when p_action='off' then 'MANUAL_OFF' else null end where id=p_id;
    update chat_messages set delivery_status='cancelled' where conversation_id=p_id and delivery_status='queued';
    update chat_jobs set state='cancelled' where conversation_id=p_id and state='pending' and kind='outbound';
  else raise exception 'INVALID_ACTION'; end if;
  insert into chat_messages(conversation_id,sender_type,message) values(p_id,'SYSTEM',p_action||' by '||p_actor);
end $$;

-- Atomic analysis/score/memory update + conditional AI enqueue. Reclaimed workers cannot finalize twice.
create function public.chat_analyze(p_job uuid,p_token uuid,p_revision integer,p_result jsonb) returns boolean
language plpgsql security definer set search_path=public as $$
declare j chat_jobs; c chat_conversations; oldintent text; score integer; m uuid; begin
  select * into strict j from chat_jobs where id=p_job;
  select * into strict c from chat_conversations where id=j.conversation_id for update;
  select * into strict j from chat_jobs where id=p_job for update;
  if j.lease_token is distinct from p_token or j.state<>'processing' then return false; end if;
  select intent into oldintent from chat_messages where id=j.message_id;
  if oldintent is not null then return false; end if;
  update chat_messages set intent=p_result->>'intent', product_id=(p_result->>'product_id')::uuid,ai_model=p_result->>'model',
    ai_confidence=(p_result->>'confidence')::numeric,purchase_intent=(p_result->>'purchase_intent')::numeric,sentiment=p_result->>'sentiment',
    lead_score_delta=coalesce((p_result->>'score_delta')::integer,0),input_tokens=coalesce((p_result->>'input_tokens')::integer,0),
    output_tokens=coalesce((p_result->>'output_tokens')::integer,0),estimated_cost_usd=(p_result->>'cost')::numeric where id=j.message_id;
  update chat_customers set lead_score=least(100,greatest(0,lead_score+coalesce((p_result->>'score_delta')::integer,0))),updated_at=now()
    where id=c.customer_id returning lead_score into score;
  update chat_customers set customer_stage=case when customer_stage in ('CUSTOMER','REPEAT') then customer_stage when score>=60 then 'HOT' when score>=30 then 'WARM' when score>0 then 'INTERESTED' else 'NEW' end where id=c.customer_id;
  update chat_customer_memory set facts=coalesce(p_result->'facts',facts),last_summary=coalesce(p_result->>'summary',last_summary),updated_at=now() where customer_id=c.customer_id;
  update chat_conversations set summary=coalesce(p_result->>'summary',summary) where id=c.id;
  if c.status<>'AI_ACTIVE' or not c.ai_enabled then return false; end if;
  if nullif(p_result->>'handoff','') is not null or score>=coalesce((p_result->>'threshold')::integer,80) then
    update chat_conversations set status='WAITING_ADMIN',ai_enabled=false,handoff_count=handoff_count+1,
      handoff_reason=coalesce(nullif(p_result->>'handoff',''),'HIGH_LEAD_SCORE'),revision=revision+1 where id=c.id;
    return false;
  end if;
  if c.revision<>p_revision or nullif(p_result->>'reply','') is null then return false; end if;
  insert into chat_messages(conversation_id,sender_type,message,external_message_id,delivery_status,product_id,grounding)
    values(c.id,'AI',p_result->>'reply','reply:'||j.message_id,'queued',(p_result->>'product_id')::uuid,coalesce(p_result->'reply_sources','[]')) returning id into m;
  insert into chat_jobs(conversation_id,message_id,kind) values(c.id,m,'outbound');
  return true;
end $$;

create function public.chat_reserve_send(p_job uuid,p_token uuid,p_enabled boolean) returns boolean
language plpgsql security definer set search_path=public as $$
declare j chat_jobs; c chat_conversations; m chat_messages; begin
  select * into strict j from chat_jobs where id=p_job;
  select * into strict c from chat_conversations where id=j.conversation_id for update;
  select * into strict j from chat_jobs where id=p_job for update;
  select * into strict m from chat_messages where id=j.message_id for update;
  if j.lease_token is distinct from p_token or j.state<>'processing' or m.delivery_status<>'queued' then return false; end if;
  if c.last_customer_message_at<now()-interval '24 hours' or
    (m.sender_type='AI' and (not p_enabled or not c.ai_enabled or c.status<>'AI_ACTIVE' or exists(select 1 from chat_jobs where conversation_id=c.id and kind='incoming' and state in ('pending','processing')))) or
    (m.sender_type='ADMIN' and c.status<>'HUMAN_ACTIVE') then
    update chat_messages set delivery_status='cancelled',error_code='MODE_OR_WINDOW_CHANGED' where id=m.id; return false;
  end if;
  update chat_messages set delivery_status='sending' where id=m.id;
  return true;
end $$;

create function public.chat_analytics() returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
 'total',(select count(*) from chat_conversations),'ai',(select count(*) from chat_conversations where status='AI_ACTIVE'),
 'human',(select count(*) from chat_conversations where status='HUMAN_ACTIVE'),'waiting',(select count(*) from chat_conversations where status='WAITING_ADMIN'),
 'closed',(select count(*) from chat_conversations where status='CLOSED'),'handoffs',(select count(*) from chat_conversations where handoff_count>0),
 'ai_resolved',(select count(*) from chat_conversations c where status='CLOSED' and handoff_count=0 and exists(select 1 from chat_messages m where m.conversation_id=c.id and m.sender_type='AI' and m.delivery_status='sent') and not exists(select 1 from chat_messages m where m.conversation_id=c.id and m.sender_type='ADMIN')),
 'hot_leads',(select count(*) from chat_customers where lead_score>=60),'purchase_intent_messages',(select count(*) from chat_messages where intent='PURCHASE_INTENT'),
 'input_tokens',(select coalesce(sum(input_tokens),0) from chat_messages),'output_tokens',(select coalesce(sum(output_tokens),0) from chat_messages),
 'cost_usd',(select sum(estimated_cost_usd) from chat_messages),'unpriced_calls',(select count(*) from chat_messages where input_tokens+output_tokens>0 and estimated_cost_usd is null),
 'response_ms',(select avg(response_ms) from chat_messages where delivery_status='sent'),
 'queue_pending',(select count(*) from chat_jobs where state='pending'),'queue_failed',(select count(*) from chat_jobs where state='failed'),
 'intents',(select coalesce(jsonb_agg(x),'[]') from(select intent,count(*) as count from chat_messages where intent is not null group by intent order by count(*) desc limit 12)x),
 'products',(select coalesce(jsonb_agg(x),'[]') from(select p.product_name,count(*) as count from chat_messages m join products p on p.id=m.product_id group by p.product_name order by count(*) desc limit 10)x),
 'questions',(select coalesce(jsonb_agg(x),'[]') from(select message,count(*) as count from chat_messages where sender_type='CUSTOMER' and intent in ('FAQ','PRICE','PROMOTION','OBJECTION') group by message order by count(*) desc limit 10)x)
);
$$;

create function public.chat_update_customer(p_id uuid,p_actor uuid,p_data jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from profiles where id=p_actor and status='approved' and role in ('owner','admin','content_lead')) then raise exception 'FORBIDDEN'; end if;
  update chat_customers set first_name=p_data->>'first_name',last_name=p_data->>'last_name',phone=p_data->>'phone',email=p_data->>'email',
    tags=array(select jsonb_array_elements_text(p_data->'tags')),updated_at=now() where id=p_id;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  insert into chat_customer_memory(customer_id,notes) values(p_id,p_data->>'notes')
    on conflict(customer_id) do update set notes=excluded.notes,updated_at=now();
end $$;

-- Functions are callable only by the trusted server service role, never browser REST.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('chat_rate_limit','chat_ingest','chat_ingest_batch','chat_claim','chat_finish','chat_control','chat_analyze','chat_reserve_send','chat_analytics','chat_update_customer') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
