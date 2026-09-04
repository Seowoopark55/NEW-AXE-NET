-- AXE NET v1.48.0
-- 051_member_credentials_admin.sql
-- 목적:
-- 1) 신규 멤버를 Supabase-only 로그인 체계로 바로 생성
-- 2) 최고관리자가 AXE NET에서 멤버 로그인 비밀번호를 재설정
-- 3) Apps Script legacy 로그인 브리지 없이 신규/기존 멤버 운영 가능

create or replace function new_axe_net.admin_set_member_password(
  p_member_key text,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_password text := coalesce(p_password, '');
  v_actor_nickname text;
begin
  if not new_axe_net.is_superadmin() then
    raise exception '최고관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if p_member_key is null
     or not exists (
       select 1 from new_axe_net.members m where m.member_key = p_member_key
     ) then
    raise exception '멤버를 찾을 수 없습니다.' using errcode = '22023';
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
    'admin_net',
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
    member_key,
    changed_by,
    changed_by_nickname,
    changed_fields,
    old_data,
    new_data
  ) values (
    p_member_key,
    auth.uid(),
    coalesce(v_actor_nickname, 'unknown'),
    array['login_password'],
    jsonb_build_object('login_password', 'unchanged'),
    jsonb_build_object('login_password', 'reset')
  );

  return true;
end;
$$;

revoke all on function new_axe_net.admin_set_member_password(text, text)
from public, anon;
grant execute on function new_axe_net.admin_set_member_password(text, text)
to authenticated;

create or replace function new_axe_net.create_member_with_password(
  p_nickname text,
  p_password text,
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
begin
  if not new_axe_net.is_superadmin() then
    raise exception '최고관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if length(coalesce(p_password, '')) < 4 or length(coalesce(p_password, '')) > 128 then
    raise exception '비밀번호는 4~128자로 입력해야 합니다.' using errcode = '22023';
  end if;

  v_member_key := new_axe_net.create_member(
    p_nickname,
    p_discord_user_id,
    p_discord_name,
    p_role,
    p_status,
    p_joined_date,
    p_badge,
    p_points
  );

  insert into new_axe_net.member_credentials (
    member_key,
    password_hash,
    migrated_from,
    password_changed_at,
    last_verified_at
  ) values (
    v_member_key,
    extensions.crypt(p_password, extensions.gen_salt('bf', 12)),
    'admin_create',
    now(),
    null
  );

  return v_member_key;
end;
$$;

revoke all on function new_axe_net.create_member_with_password(
  text, text, text, text, text, text, date, text, integer
) from public, anon;
grant execute on function new_axe_net.create_member_with_password(
  text, text, text, text, text, text, date, text, integer
) to authenticated;

notify pgrst, 'reload schema';
