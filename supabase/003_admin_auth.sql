-- AXE NET v0.5
-- 003_admin_auth.sql
-- AXE WAR Supabase 프로젝트의 SQL Editor에서 실행합니다.
--
-- 목적:
-- 1) Supabase Auth 사용자를 AXE NET 관리자 멤버와 연결
-- 2) 관리자 여부를 DB에서 판정
-- 3) members base table의 쓰기 권한을 관리자에게만 허용할 준비
--
-- 이 SQL은 Auth 사용자를 자동 생성하지 않습니다.
-- 실행 후 Supabase Authentication > Users 에서 관리자 계정을 만든 뒤,
-- README의 '관리자 연결' SQL을 별도로 한 번 실행하세요.

create schema if not exists new_axe_net;

create table if not exists new_axe_net.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  member_key text not null unique references new_axe_net.members(member_key) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists admin_accounts_touch_updated_at
on new_axe_net.admin_accounts;

create trigger admin_accounts_touch_updated_at
before update on new_axe_net.admin_accounts
for each row
execute function new_axe_net.touch_updated_at();

alter table new_axe_net.admin_accounts enable row level security;

revoke all on table new_axe_net.admin_accounts from anon, authenticated;
grant select on table new_axe_net.admin_accounts to authenticated;

drop policy if exists "admin_accounts_read_self"
on new_axe_net.admin_accounts;

create policy "admin_accounts_read_self"
on new_axe_net.admin_accounts
for select
to authenticated
using (user_id = auth.uid());

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
    where account.user_id = auth.uid()
      and account.enabled = true
  );
$$;

revoke all on function new_axe_net.is_admin() from public;
grant execute on function new_axe_net.is_admin() to authenticated;

-- 로그인한 관리자가 자신의 연결정보 + 멤버 표시명을 한 번에 읽는 뷰
create or replace view new_axe_net.admin_session
with (security_invoker = true)
as
select
  account.user_id,
  account.member_key,
  member.nickname,
  member.role,
  account.enabled
from new_axe_net.admin_accounts account
join new_axe_net.members member
  on member.member_key = account.member_key
where account.user_id = auth.uid();

revoke all on new_axe_net.admin_session from public;
grant select on new_axe_net.admin_session to authenticated;

-- 향후 멤버 수정 기능용 권한.
-- RLS가 최종 방어선이며, admin_accounts에 등록된 Auth 사용자만 통과합니다.
grant select, update on table new_axe_net.members to authenticated;

drop policy if exists "members_admin_read"
on new_axe_net.members;

create policy "members_admin_read"
on new_axe_net.members
for select
to authenticated
using (new_axe_net.is_admin());

drop policy if exists "members_admin_update"
on new_axe_net.members;

create policy "members_admin_update"
on new_axe_net.members
for update
to authenticated
using (new_axe_net.is_admin())
with check (new_axe_net.is_admin());

grant usage on schema new_axe_net to authenticated;

notify pgrst, 'reload schema';
