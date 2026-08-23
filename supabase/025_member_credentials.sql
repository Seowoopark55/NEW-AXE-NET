-- NEW AXE NET v1.27.0
-- 025_member_credentials.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행
--
-- 목적
-- 1) 일반 멤버 로그인 자격증명을 NEW AXE NET 전용 schema에 서버 전용으로 보관
-- 2) 브라우저 / anon / authenticated 역할에는 비밀번호 해시조차 노출하지 않음
-- 3) 기존 AXE NET 비밀번호는 첫 로그인 성공 시에만 안전하게 해시 이관
-- 4) 자격증명 이관이 끝난 멤버는 Apps Script를 거치지 않고 Supabase에서 바로 검증
--
-- 중요
-- - 이 SQL 실행만으로 현재 로그인 동작은 바뀌지 않습니다.
-- - 비밀번호 평문은 저장하지 않습니다.
-- - service_role 키는 Vercel 서버 환경변수에만 존재해야 합니다.

create schema if not exists new_axe_net;
create extension if not exists pgcrypto with schema extensions;

create table if not exists new_axe_net.member_credentials (
  member_key text primary key
    references new_axe_net.members(member_key)
    on update cascade
    on delete cascade,
  password_hash text not null,
  migrated_from text not null default 'server',
  password_changed_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_credentials_password_hash_check
    check (length(password_hash) >= 20)
);

create index if not exists member_credentials_last_verified_idx
on new_axe_net.member_credentials (last_verified_at desc);

alter table new_axe_net.member_credentials enable row level security;

revoke all on table new_axe_net.member_credentials from public, anon, authenticated;
grant usage on schema new_axe_net to service_role;
grant select, insert, update, delete on table new_axe_net.member_credentials to service_role;

-- 로그인 대상 조회: 동일 닉네임의 active 멤버가 정확히 1명일 때만 반환합니다.
-- password hash는 절대 반환하지 않습니다.
create or replace function new_axe_net.get_member_login_target(
  p_nickname text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nickname text := nullif(btrim(coalesce(p_nickname, '')), '');
  v_count integer := 0;
  v_member new_axe_net.members%rowtype;
begin
  if v_nickname is null then
    return null;
  end if;

  select count(*)
    into v_count
  from new_axe_net.members m
  where lower(btrim(m.nickname)) = lower(v_nickname)
    and m.status = 'active';

  if v_count <> 1 then
    return null;
  end if;

  select m.*
    into v_member
  from new_axe_net.members m
  where lower(btrim(m.nickname)) = lower(v_nickname)
    and m.status = 'active'
  order by m.id
  limit 1;

  return jsonb_build_object(
    'member', jsonb_build_object(
      'member_key', v_member.member_key,
      'nickname', v_member.nickname,
      'role', v_member.role,
      'status', v_member.status,
      'discord_user_id', v_member.discord_user_id,
      'discord_name', v_member.discord_name,
      'badge', v_member.badge,
      'points', v_member.points
    ),
    'has_credential', exists (
      select 1
      from new_axe_net.member_credentials c
      where c.member_key = v_member.member_key
    )
  );
end;
$$;

revoke all on function new_axe_net.get_member_login_target(text) from public, anon, authenticated;
grant execute on function new_axe_net.get_member_login_target(text) to service_role;

-- 서버 전용 비밀번호 설정 / 첫 로그인 이관용 RPC
create or replace function new_axe_net.set_member_password(
  p_member_key text,
  p_password text,
  p_migrated_from text default 'server'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_password text := coalesce(p_password, '');
  v_source text := coalesce(nullif(btrim(coalesce(p_migrated_from, '')), ''), 'server');
begin
  if p_member_key is null
     or not exists (
       select 1
       from new_axe_net.members m
       where m.member_key = p_member_key
         and m.status = 'active'
     ) then
    raise exception '활성 멤버를 찾을 수 없습니다.' using errcode = '22023';
  end if;

  if length(v_password) < 4 or length(v_password) > 128 then
    raise exception '비밀번호는 4~128자로 입력해야 합니다.' using errcode = '22023';
  end if;

  insert into new_axe_net.member_credentials (
    member_key,
    password_hash,
    migrated_from,
    password_changed_at,
    last_verified_at
  )
  values (
    p_member_key,
    extensions.crypt(v_password, extensions.gen_salt('bf', 12)),
    v_source,
    now(),
    null
  )
  on conflict (member_key) do update
  set
    password_hash = excluded.password_hash,
    migrated_from = excluded.migrated_from,
    password_changed_at = now(),
    last_verified_at = null,
    updated_at = now();

  return true;
end;
$$;

revoke all on function new_axe_net.set_member_password(text, text, text) from public, anon, authenticated;
grant execute on function new_axe_net.set_member_password(text, text, text) to service_role;

-- 서버 전용 로그인 검증 RPC
create or replace function new_axe_net.verify_member_credentials(
  p_nickname text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text := nullif(btrim(coalesce(p_nickname, '')), '');
  v_password text := coalesce(p_password, '');
  v_member_key text;
  v_result jsonb;
begin
  if v_nickname is null or v_password = '' then
    return null;
  end if;

  select
    m.member_key,
    jsonb_build_object(
      'member_key', m.member_key,
      'nickname', m.nickname,
      'role', m.role,
      'status', m.status,
      'discord_user_id', m.discord_user_id,
      'discord_name', m.discord_name,
      'badge', m.badge,
      'points', m.points
    )
  into
    v_member_key,
    v_result
  from new_axe_net.members m
  join new_axe_net.member_credentials c
    on c.member_key = m.member_key
  where lower(btrim(m.nickname)) = lower(v_nickname)
    and m.status = 'active'
    and c.password_hash = extensions.crypt(v_password, c.password_hash)
  order by m.id
  limit 1;

  if v_member_key is null then
    return null;
  end if;

  update new_axe_net.member_credentials
     set last_verified_at = now(),
         updated_at = now()
   where member_key = v_member_key;

  return v_result;
end;
$$;

revoke all on function new_axe_net.verify_member_credentials(text, text) from public, anon, authenticated;
grant execute on function new_axe_net.verify_member_credentials(text, text) to service_role;

notify pgrst, 'reload schema';

-- =========================================================
-- 이관 진행상태 확인용 (Supabase SQL Editor에서만 실행)
-- =========================================================
--
-- select
--   count(*) filter (where m.status = 'active') as active_members,
--   count(*) filter (where m.status = 'active' and c.member_key is not null) as migrated_credentials,
--   count(*) filter (where m.status = 'active' and c.member_key is null) as remaining_credentials
-- from new_axe_net.members m
-- left join new_axe_net.member_credentials c on c.member_key = m.member_key;
--
-- 아직 첫 로그인을 하지 않은 active 멤버:
-- select m.nickname, m.member_key
-- from new_axe_net.members m
-- left join new_axe_net.member_credentials c on c.member_key = m.member_key
-- where m.status = 'active'
--   and c.member_key is null
-- order by m.sort_order, m.id;
