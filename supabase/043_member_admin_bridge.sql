-- AXE NET v1.40.0
-- 043_member_admin_bridge.sql
-- MEMBER ADMIN BRIDGE
--
-- 운영 원칙
-- 1) 최고관리자(superadmin): 기존 Supabase Auth 이메일 인증 유지
-- 2) 운영진(operator): members.role='admin'이면 닉네임/비밀번호 로그인만으로 내부 Auth 자동 연결
-- 3) 운영진은 기존 관리자 RLS/RPC를 사용할 수 있지만 멤버 생성/수정/권한 부여는 할 수 없음
-- 4) role을 user로 내리거나 status가 active가 아니면 기존 Auth 세션이 남아 있어도 DB 관리자 권한 즉시 차단

create schema if not exists new_axe_net;

-- =========================================================
-- 1. 관리자 등급
-- 기존 수동 관리자 연결은 최고관리자로 유지합니다.
-- Vercel이 만드는 내부 운영진 계정은 코드에서 operator로 저장합니다.
-- =========================================================
alter table new_axe_net.admin_accounts
  add column if not exists admin_level text not null default 'superadmin';

alter table new_axe_net.admin_accounts
  drop constraint if exists admin_accounts_admin_level_check;

alter table new_axe_net.admin_accounts
  add constraint admin_accounts_admin_level_check
  check (admin_level in ('superadmin', 'operator'));

grant usage on schema new_axe_net to service_role;
grant select, insert, update, delete on table new_axe_net.admin_accounts to service_role;
grant select on table new_axe_net.members to service_role;

-- =========================================================
-- 2. 공통 관리자 판정
-- =========================================================
create or replace function new_axe_net.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from new_axe_net.admin_accounts account
    join new_axe_net.members member
      on member.member_key = account.member_key
    where account.user_id = auth.uid()
      and account.enabled = true
      and account.admin_level in ('superadmin', 'operator')
      and member.status = 'active'
      and lower(coalesce(member.role, '')) = 'admin'
  );
$$;

revoke all on function new_axe_net.is_admin() from public;
grant execute on function new_axe_net.is_admin() to authenticated;

-- 최고관리자 전용 판정
create or replace function new_axe_net.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from new_axe_net.admin_accounts account
    join new_axe_net.members member
      on member.member_key = account.member_key
    where account.user_id = auth.uid()
      and account.enabled = true
      and account.admin_level = 'superadmin'
      and member.status = 'active'
      and lower(coalesce(member.role, '')) = 'admin'
  );
$$;

revoke all on function new_axe_net.is_superadmin() from public;
grant execute on function new_axe_net.is_superadmin() to authenticated;

-- =========================================================
-- 3. 관리자 세션 뷰
-- =========================================================
create or replace view new_axe_net.admin_session
with (security_invoker = true)
as
select
  account.user_id,
  account.member_key,
  member.nickname,
  member.role,
  account.enabled,
  account.admin_level
from new_axe_net.admin_accounts account
join new_axe_net.members member
  on member.member_key = account.member_key
where account.user_id = auth.uid()
  and account.enabled = true
  and account.admin_level in ('superadmin', 'operator')
  and member.status = 'active'
  and lower(coalesce(member.role, '')) = 'admin';

revoke all on new_axe_net.admin_session from public, anon;
grant select on new_axe_net.admin_session to authenticated;

-- self 연결정보도 실제 관리자 상태일 때만 조회
alter table new_axe_net.admin_accounts enable row level security;

drop policy if exists "admin_accounts_read_self"
on new_axe_net.admin_accounts;

create policy "admin_accounts_read_self"
on new_axe_net.admin_accounts
for select
to authenticated
using (
  user_id = auth.uid()
  and enabled = true
  and admin_level in ('superadmin', 'operator')
  and exists (
    select 1
    from new_axe_net.members member
    where member.member_key = admin_accounts.member_key
      and member.status = 'active'
      and lower(coalesce(member.role, '')) = 'admin'
  )
);

-- =========================================================
-- 4. 멤버 관리만 최고관리자 전용으로 제한
-- 운영진은 공금 등 운영 기능을 쓸 수 있지만 다른 멤버의 권한을 부여할 수 없습니다.
-- =========================================================
drop policy if exists "members_admin_update"
on new_axe_net.members;

create policy "members_admin_update"
on new_axe_net.members
for update
to authenticated
using (new_axe_net.is_superadmin())
with check (new_axe_net.is_superadmin());

drop policy if exists "member_audit_admin_read"
on new_axe_net.member_audit_log;

create policy "member_audit_admin_read"
on new_axe_net.member_audit_log
for select
to authenticated
using (new_axe_net.is_superadmin());

-- create_member도 최고관리자만 실행 가능하도록 기존 함수를 동일 동작으로 재정의
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
  if not new_axe_net.is_superadmin() then
    raise exception '최고관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  v_nickname := nullif(btrim(p_nickname), '');
  if v_nickname is null then
    raise exception '닉네임을 입력하세요.' using errcode = '22023';
  end if;

  if p_role not in ('admin', 'user') then
    raise exception '올바르지 않은 권한 값입니다.' using errcode = '22023';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception '신규 멤버 상태는 활동 또는 비활성만 가능합니다.' using errcode = '22023';
  end if;

  if p_points is null or p_points < 0 then
    raise exception '포인트는 0 이상의 정수여야 합니다.' using errcode = '22023';
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
    substr(md5(random()::text || clock_timestamp()::text || v_nickname), 1, 10);

  insert into new_axe_net.members (
    member_key, discord_user_id, discord_name, nickname,
    role, status, joined_date, badge, points, sort_order
  ) values (
    v_member_key, v_discord_user_id, v_discord_name, v_nickname,
    p_role, p_status, coalesce(p_joined_date, current_date),
    v_badge, p_points, v_sort_order
  );

  select member.nickname
  into v_actor_nickname
  from new_axe_net.admin_accounts account
  join new_axe_net.members member
    on member.member_key = account.member_key
  where account.user_id = auth.uid()
    and account.enabled = true
    and account.admin_level = 'superadmin'
  limit 1;

  insert into new_axe_net.member_audit_log (
    member_key, changed_by, changed_by_nickname,
    changed_fields, old_data, new_data
  ) values (
    v_member_key,
    auth.uid(),
    coalesce(v_actor_nickname, 'unknown'),
    array['nickname', 'role', 'status', 'badge', 'points'],
    jsonb_build_object(
      'nickname', null, 'role', null, 'status', null,
      'badge', null, 'points', null, 'resigned_at', null
    ),
    jsonb_build_object(
      'nickname', v_nickname, 'role', p_role, 'status', p_status,
      'badge', v_badge, 'points', p_points, 'resigned_at', null
    )
  );

  return v_member_key;
end;
$$;

revoke all on function new_axe_net.create_member(
  text,text,text,text,text,date,text,integer
) from public, anon;

grant execute on function new_axe_net.create_member(
  text,text,text,text,text,date,text,integer
) to authenticated;

notify pgrst, 'reload schema';

-- =========================================================
-- 5. 적용 확인
-- 모두 true + 현재 최고관리자 계정이 superadmin이면 완료
-- =========================================================
select
  to_regclass('new_axe_net.admin_accounts') is not null as admin_accounts_ready,
  to_regprocedure('new_axe_net.is_admin()') is not null as is_admin_ready,
  to_regprocedure('new_axe_net.is_superadmin()') is not null as is_superadmin_ready,
  to_regclass('new_axe_net.admin_session') is not null as admin_session_ready,
  has_table_privilege('service_role', 'new_axe_net.admin_accounts', 'SELECT') as service_select_ready,
  has_table_privilege('service_role', 'new_axe_net.admin_accounts', 'INSERT') as service_insert_ready,
  has_table_privilege('service_role', 'new_axe_net.admin_accounts', 'UPDATE') as service_update_ready;

select
  a.member_key,
  m.nickname,
  a.admin_level,
  a.enabled
from new_axe_net.admin_accounts a
join new_axe_net.members m on m.member_key = a.member_key
order by a.created_at;
