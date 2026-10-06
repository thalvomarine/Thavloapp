-- THALVO AI core: boat records, long-term memory, conversational log.
-- Paste into the Supabase SQL editor. Safe to re-run.
-- The embedding column is nullable so a memory still saves when the
-- embedding provider is down. Row level security is owner-only.

set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'vector') then
    create extension vector with schema extensions;
  end if;
end $$;

create table if not exists public.user_boats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  boat_brand text,
  engine_brand text,
  engine_model text,
  serial_number text,
  created_at timestamptz not null default now(),
  constraint user_boats_boat_brand_len check (boat_brand is null or char_length(btrim(boat_brand)) between 1 and 80),
  constraint user_boats_engine_brand_len check (engine_brand is null or char_length(btrim(engine_brand)) between 1 and 80),
  constraint user_boats_engine_model_len check (engine_model is null or char_length(btrim(engine_model)) between 1 and 80),
  constraint user_boats_serial_len check (serial_number is null or char_length(btrim(serial_number)) between 1 and 64)
);

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_text text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  constraint ai_memories_text_len check (char_length(btrim(memory_text)) between 1 and 2000)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_role_chk check (role in ('user', 'assistant', 'system')),
  constraint chat_messages_content_len check (char_length(content) between 1 and 8000)
);

create index if not exists user_boats_user_created_idx
  on public.user_boats (user_id, created_at desc);

create index if not exists ai_memories_user_created_idx
  on public.ai_memories (user_id, created_at desc);

create index if not exists ai_memories_embedding_hnsw
  on public.ai_memories
  using hnsw (embedding vector_cosine_ops);

create index if not exists chat_messages_session_idx
  on public.chat_messages (user_id, session_id, created_at);

alter table public.user_boats enable row level security;
alter table public.ai_memories enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "user_boats: select own" on public.user_boats;
create policy "user_boats: select own"
  on public.user_boats for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_boats: insert own" on public.user_boats;
create policy "user_boats: insert own"
  on public.user_boats for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_boats: update own" on public.user_boats;
create policy "user_boats: update own"
  on public.user_boats for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_boats: delete own" on public.user_boats;
create policy "user_boats: delete own"
  on public.user_boats for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "ai_memories: select own" on public.ai_memories;
create policy "ai_memories: select own"
  on public.ai_memories for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "ai_memories: insert own" on public.ai_memories;
create policy "ai_memories: insert own"
  on public.ai_memories for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "ai_memories: delete own" on public.ai_memories;
create policy "ai_memories: delete own"
  on public.ai_memories for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "chat_messages: select own" on public.chat_messages;
create policy "chat_messages: select own"
  on public.chat_messages for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "chat_messages: insert own" on public.chat_messages;
create policy "chat_messages: insert own"
  on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid());

revoke all on public.user_boats from public, anon;
revoke all on public.ai_memories from public, anon;
revoke all on public.chat_messages from public, anon;

grant select, insert, update, delete on public.user_boats to authenticated;
grant select, insert, delete on public.ai_memories to authenticated;
grant select, insert on public.chat_messages to authenticated;

grant all on public.user_boats to service_role;
grant all on public.ai_memories to service_role;
grant all on public.chat_messages to service_role;

create or replace function public.match_ai_memories(
  query_embedding vector(1536),
  match_count integer,
  match_user uuid
)
returns table (
  id uuid,
  memory_text text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    m.id,
    m.memory_text,
    (1 - (m.embedding <=> query_embedding))::double precision as similarity
  from public.ai_memories m
  where m.user_id = auth.uid()
    and m.user_id = match_user
    and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 1), 1), 12);
$$;

revoke all on function public.match_ai_memories(vector, integer, uuid) from public, anon;
grant execute on function public.match_ai_memories(vector, integer, uuid) to authenticated, service_role;
