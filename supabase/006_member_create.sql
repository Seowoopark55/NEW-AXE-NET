-- AXE NET v0.8
-- 006_member_create.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행

create or replace function new_axe_net.create_member(
  p_nickname text,
  p_discord_user_id text default null,
  p_discord_name text default null,
  p_role text default 'user',
  p_status text default 'active',
  p_joined_date date default current_date,
  p_badge text default 'bronze',
  p_points integer default 0
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key text;
  v_nickname text;
  v_discord_user_id text;
  v_discord_name text;
  v_badge text;
  v_sort_order integer;
  v_actor_nickname text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  v_nickname := nullif(btrim(p_nickname), '');

  if v_nickname is null then
    raise exception '닉네임을 입력하세요.'
      using errcode = '22023';
  end if;

  if p_role not in ('admin', 'user') then
    raise exception '올바르지 않은 권한 값입니다.'
      using errcode = '22023';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception '신규 멤버 상태는 활동 또는 비활성만 가능합니다.'
      using errcode = '22023';
  end if;

  if p_points is null or p_points < 0 then
    raise exception '포인트는 0 이상의 정수여야 합니다.'
      using errcode = '22023';
  end if;

  v_discord_user_id := nullif(btrim(p_discord_user_id), '');
  v_discord_name := nullif(btrim(p_discord_name), '');
  v_badge := nullif(btrim(p_badge), '');

  select coalesce(max(sort_order), 0) + 1
    into v_sort_order
  from new_axe_net.members;

  v_member_key :=
    'member_' ||
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text ||
    '_' ||
    substr(
      md5(random()::text || clock_timestamp()::text || v_nickname),
      1,
      10
    );

  insert into new_axe_net.members (
    member_key,
    discord_user_id,
    discord_name,
    nickname,
    role,
    status,
    joined_date,
    badge,
    points,
    sort_order
  )
  values (
    v_member_key,
    v_discord_user_id,
    v_discord_name,
    v_nickname,
    p_role,
    p_status,
    coalesce(p_joined_date, current_date),
    v_badge,
    p_points,
    v_sort_order
  );

  select member.nickname
    into v_actor_nickname
  from new_axe_net.admin_accounts account
  join new_axe_net.members member
    on member.member_key = account.member_key
  where account.user_id = auth.uid()
    and account.enabled = true
  limit 1;

  insert into new_axe_net.member_audit_log (
    member_key,
    changed_by,
    changed_by_nickname,
    changed_fields,
    old_data,
    new_data
  )
  values (
    v_member_key,
    auth.uid(),
    coalesce(v_actor_nickname, 'unknown'),
    array['nickname', 'role', 'status', 'badge', 'points'],
    jsonb_build_object(
      'nickname', null,
      'role', null,
      'status', null,
      'badge', null,
      'points', null,
      'resigned_at', null
    ),
    jsonb_build_object(
      'nickname', v_nickname,
      'role', p_role,
      'status', p_status,
      'badge', v_badge,
      'points', p_points,
      'resigned_at', null
    )
  );

  return v_member_key;
end;
$$;

revoke all on function new_axe_net.create_member(
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  integer
) from public;

revoke all on function new_axe_net.create_member(
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  integer
) from anon;

grant execute on function new_axe_net.create_member(
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  integer
) to authenticated;

notify pgrst, 'reload schema';
