-- AXE NET v1.47.6
-- 050_member_account_alias_admin.sql
-- 플리카 계좌 별칭을 NEW AXE NET 관리자 화면에서 안전하게 관리하기 위한 RLS/RPC 추가
--
-- 전제
-- - new_axe_net.member_account_aliases 테이블은 AXE BOT 계좌 별칭 기능에서 이미 사용 중
-- - 컬럼: id, member_key, alias, alias_key, enabled, created_by, updated_by, created_at, updated_at
-- - 026_assets_plika.sql 적용 완료
--
-- 이 migration은 기존 별칭 데이터 자체를 삭제/변경하지 않습니다.

alter table new_axe_net.member_account_aliases enable row level security;

grant select on table new_axe_net.member_account_aliases to authenticated;
grant select, insert, update, delete on table new_axe_net.member_account_aliases to service_role;

drop policy if exists member_account_aliases_admin_read on new_axe_net.member_account_aliases;
create policy member_account_aliases_admin_read
on new_axe_net.member_account_aliases
for select
to authenticated
using (new_axe_net.is_admin());

create or replace function new_axe_net.account_alias_key(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(normalize(btrim(coalesce(p_value,'')), NFKC), '\s+', '', 'g'));
$$;

create or replace function new_axe_net.save_member_account_alias(
  p_member_key text,
  p_alias text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_key text := nullif(btrim(coalesce(p_member_key,'')), '');
  v_alias text := nullif(btrim(coalesce(p_alias,'')), '');
  v_alias_key text;
  v_nickname text;
  v_actor text;
  v_existing new_axe_net.member_account_aliases%rowtype;
  v_id bigint;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode='42501';
  end if;

  if v_member_key is null then
    raise exception '멤버를 선택하세요.' using errcode='22023';
  end if;

  if v_alias is null then
    raise exception '추가할 별칭을 입력하세요.' using errcode='22023';
  end if;

  if length(v_alias) > 40 then
    raise exception '별칭은 40자 이하로 입력하세요.' using errcode='22023';
  end if;

  select m.nickname
    into v_nickname
    from new_axe_net.members m
   where m.member_key = v_member_key
   limit 1;

  if v_nickname is null then
    raise exception '멤버를 찾을 수 없습니다.' using errcode='P0002';
  end if;

  if not exists (
    select 1
      from new_axe_net.member_accounts a
     where a.member_key = v_member_key
  ) then
    raise exception '계좌를 먼저 등록해주세요.' using errcode='22023';
  end if;

  v_alias_key := new_axe_net.account_alias_key(v_alias);
  if v_alias_key = '' then
    raise exception '추가할 별칭을 입력하세요.' using errcode='22023';
  end if;

  if new_axe_net.account_alias_key(v_nickname) = v_alias_key then
    raise exception '대표 멤버명과 같은 값은 별칭으로 추가할 필요가 없습니다.' using errcode='22023';
  end if;

  if exists (
    select 1
      from new_axe_net.members m
     where m.member_key <> v_member_key
       and new_axe_net.account_alias_key(m.nickname) = v_alias_key
  ) then
    raise exception '다른 멤버의 대표 이름은 별칭으로 사용할 수 없습니다.' using errcode='23505';
  end if;

  select a.*
    into v_existing
    from new_axe_net.member_account_aliases a
   where a.alias_key = v_alias_key
   order by a.enabled desc, a.id asc
   limit 1
   for update;

  if v_existing.id is not null
     and v_existing.enabled is true
     and v_existing.member_key <> v_member_key then
    raise exception '이미 다른 계좌에서 사용 중인 별칭입니다.' using errcode='23505';
  end if;

  v_actor := coalesce(new_axe_net.asset_actor_nickname(), 'ADMIN');

  if v_existing.id is not null then
    update new_axe_net.member_account_aliases
       set member_key = v_member_key,
           alias = v_alias,
           alias_key = v_alias_key,
           enabled = true,
           updated_by = v_actor,
           updated_at = now()
     where id = v_existing.id
     returning id into v_id;
  else
    insert into new_axe_net.member_account_aliases (
      member_key, alias, alias_key, enabled, created_by, updated_by
    ) values (
      v_member_key, v_alias, v_alias_key, true, v_actor, v_actor
    ) returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function new_axe_net.deactivate_member_account_alias(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_actor text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode='42501';
  end if;

  v_actor := coalesce(new_axe_net.asset_actor_nickname(), 'ADMIN');

  update new_axe_net.member_account_aliases
     set enabled = false,
         updated_by = v_actor,
         updated_at = now()
   where id = p_id
     and enabled = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function new_axe_net.account_alias_key(text) from public, anon;
grant execute on function new_axe_net.account_alias_key(text) to authenticated, service_role;

revoke all on function new_axe_net.save_member_account_alias(text,text) from public, anon;
grant execute on function new_axe_net.save_member_account_alias(text,text) to authenticated;

revoke all on function new_axe_net.deactivate_member_account_alias(bigint) from public, anon;
grant execute on function new_axe_net.deactivate_member_account_alias(bigint) to authenticated;

notify pgrst, 'reload schema';
