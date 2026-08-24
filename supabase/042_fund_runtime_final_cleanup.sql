-- NEW AXE NET v1.39.0
-- 042_fund_runtime_final_cleanup.sql
-- 공금 최종 런타임 정리
-- 목적:
-- 1) 공금 운영 원본을 NEW AXE NET Supabase로 고정
-- 2) Discord ↔ 멤버 계정연동 저장/해제를 Apps Script 없이 NEW Supabase에서 직접 처리
-- 3) BOT은 service_role 전용 RPC만 사용

-- =========================================================
-- 0. 전환 상태 확인
-- =========================================================
do $$
begin
  if not exists (
    select 1
    from new_axe_net.fund_runtime_config
    where id = 1
      and primary_source = 'new_axe_net'
  ) then
    raise exception '공금이 아직 NEW AXE NET 최종 전환 상태가 아닙니다.';
  end if;
end
$$;

-- =========================================================
-- 1. Discord 계정연동 저장
--    NEW members는 1 member ↔ 1 Discord 구조입니다.
--    동일 Discord ID가 다른 멤버에 연결되어 있으면 기존 연결을 해제하고 재배정합니다.
-- =========================================================
create or replace function new_axe_net.bot_save_member_discord_link(
  p_discord_user_id text,
  p_discord_name text,
  p_member_nickname text,
  p_editor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discord_id text := nullif(btrim(p_discord_user_id), '');
  v_discord_name text := nullif(btrim(p_discord_name), '');
  v_nickname text := nullif(btrim(p_member_nickname), '');
  v_editor text := coalesce(nullif(btrim(p_editor), ''), 'AXE BOT');
  v_target new_axe_net.members%rowtype;
  v_previous_member_key text;
  v_previous_nickname text;
  v_previous_discord_id text;
  v_target_old_discord_id text;
  v_match_count integer := 0;
begin
  perform pg_advisory_xact_lock(1380138071);

  if not exists (
    select 1 from new_axe_net.fund_runtime_config
    where id = 1 and primary_source = 'new_axe_net'
  ) then
    raise exception '공금 운영 원본이 NEW AXE NET이 아닙니다.' using errcode = '55000';
  end if;

  if v_discord_id is null or v_discord_id !~ '^[0-9]+$' then
    raise exception '올바른 Discord 사용자 ID가 필요합니다.' using errcode = '22023';
  end if;

  if v_nickname is null then
    raise exception 'NEW AXE NET 멤버 이름이 필요합니다.' using errcode = '22023';
  end if;

  select count(*)
  into v_match_count
  from new_axe_net.members m
  where m.status = 'active'
    and lower(btrim(m.nickname)) = lower(v_nickname);

  if v_match_count = 0 then
    raise exception '활성 NEW AXE NET 멤버를 찾을 수 없습니다: %', v_nickname using errcode = '22023';
  end if;

  if v_match_count > 1 then
    raise exception '같은 닉네임의 활성 멤버가 여러 명입니다. NEW AXE NET 멤버 정보를 먼저 정리해주세요: %', v_nickname using errcode = '21000';
  end if;

  select m.*
  into v_target
  from new_axe_net.members m
  where m.status = 'active'
    and lower(btrim(m.nickname)) = lower(v_nickname)
  for update;

  v_target_old_discord_id := nullif(btrim(v_target.discord_user_id), '');

  select m.member_key, m.nickname, m.discord_user_id
  into v_previous_member_key, v_previous_nickname, v_previous_discord_id
  from new_axe_net.members m
  where m.discord_user_id = v_discord_id
  limit 1
  for update;

  -- 같은 Discord 계정이 다른 멤버에 연결되어 있으면 기존 연결 해제 후 재배정
  if v_previous_member_key is not null and v_previous_member_key <> v_target.member_key then
    update new_axe_net.members
    set discord_user_id = null,
        discord_name = null,
        updated_at = now()
    where member_key = v_previous_member_key;
  else
    v_previous_member_key := null;
    v_previous_nickname := null;
    v_previous_discord_id := null;
  end if;

  update new_axe_net.members
  set discord_user_id = v_discord_id,
      discord_name = coalesce(v_discord_name, discord_name),
      updated_at = now()
  where member_key = v_target.member_key;

  return jsonb_build_object(
    'success', true,
    'code', case
      when v_previous_member_key is not null then 'REASSIGNED'
      when v_target_old_discord_id is not null and v_target_old_discord_id <> v_discord_id then 'REPLACED'
      else 'SAVED'
    end,
    'previous_nickname', v_previous_nickname,
    'previous_discord_user_id', case
      when v_previous_member_key is not null then v_previous_discord_id
      when v_target_old_discord_id is not null and v_target_old_discord_id <> v_discord_id then v_target_old_discord_id
      else null
    end,
    'editor', v_editor,
    'link', jsonb_build_object(
      'member_key', v_target.member_key,
      'nickname', v_target.nickname,
      'discord_user_id', v_discord_id,
      'discord_name', coalesce(v_discord_name, v_target.discord_name)
    )
  );
end;
$$;

revoke all on function new_axe_net.bot_save_member_discord_link(text,text,text,text)
from public, anon, authenticated;
grant execute on function new_axe_net.bot_save_member_discord_link(text,text,text,text)
to service_role;

-- =========================================================
-- 2. Discord 계정연동 해제
-- =========================================================
create or replace function new_axe_net.bot_delete_member_discord_link(
  p_discord_user_id text,
  p_editor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discord_id text := nullif(btrim(p_discord_user_id), '');
  v_editor text := coalesce(nullif(btrim(p_editor), ''), 'AXE BOT');
  v_member new_axe_net.members%rowtype;
begin
  perform pg_advisory_xact_lock(1380138072);

  if not exists (
    select 1 from new_axe_net.fund_runtime_config
    where id = 1 and primary_source = 'new_axe_net'
  ) then
    raise exception '공금 운영 원본이 NEW AXE NET이 아닙니다.' using errcode = '55000';
  end if;

  if v_discord_id is null or v_discord_id !~ '^[0-9]+$' then
    raise exception '올바른 Discord 사용자 ID가 필요합니다.' using errcode = '22023';
  end if;

  select m.*
  into v_member
  from new_axe_net.members m
  where m.discord_user_id = v_discord_id
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'editor', v_editor,
      'discord_user_id', v_discord_id
    );
  end if;

  update new_axe_net.members
  set discord_user_id = null,
      discord_name = null,
      updated_at = now()
  where member_key = v_member.member_key;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'editor', v_editor,
    'member_key', v_member.member_key,
    'nickname', v_member.nickname,
    'discord_user_id', v_discord_id
  );
end;
$$;

revoke all on function new_axe_net.bot_delete_member_discord_link(text,text)
from public, anon, authenticated;
grant execute on function new_axe_net.bot_delete_member_discord_link(text,text)
to service_role;

-- BOT 조회 보정
grant usage on schema new_axe_net to service_role;
grant select on table new_axe_net.members to service_role;
grant select on table new_axe_net.fund_runtime_config to service_role;

notify pgrst, 'reload schema';

-- =========================================================
-- 적용 확인: 모두 true / new_axe_net이면 완료
-- =========================================================
select
  to_regprocedure('new_axe_net.bot_save_member_discord_link(text,text,text,text)') is not null as link_save_ready,
  to_regprocedure('new_axe_net.bot_delete_member_discord_link(text,text)') is not null as link_delete_ready,
  (
    select primary_source
    from new_axe_net.fund_runtime_config
    where id = 1
  ) as fund_primary_source;
