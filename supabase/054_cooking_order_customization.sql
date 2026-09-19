-- AXE NET · COOKING ORDER CUSTOMIZATION R2
-- 054_cooking_order_customization.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 1회 실행
--
-- 목적
-- 1) AXE BOT의 하드코딩된 요리 주문 선택지를 DB 기반 메뉴로 전환
-- 2) AXE NET 관리자 화면에서 메뉴명 / 설명 / 가격 / 순서 / 사용 여부를 관리
-- 3) Discord 주문 안내 일정 / 추가 안내문을 AXE NET에서 관리
-- 4) 기존 1 / 2M / 2G / 3 주문키와 기존 주문 기록은 그대로 호환

create schema if not exists new_axe_net;

create table if not exists new_axe_net.cooking_order_types (
  type_key text primary key,
  label text not null,
  short_label text not null,
  detail text not null default '',
  price_per_set integer not null default 0,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint cooking_order_types_type_key_check
    check (type_key ~ '^[A-Za-z0-9_-]{1,14}$'),
  constraint cooking_order_types_label_check
    check (char_length(btrim(label)) between 1 and 100),
  constraint cooking_order_types_short_label_check
    check (char_length(btrim(short_label)) between 1 and 50),
  constraint cooking_order_types_detail_check
    check (char_length(detail) <= 100),
  constraint cooking_order_types_price_check
    check (price_per_set between 0 and 1000000000),
  constraint cooking_order_types_sort_check
    check (sort_order between 0 and 9999)
);

create table if not exists new_axe_net.cooking_order_config (
  config_key text primary key default 'default',
  schedule_text text not null default '',
  extra_guide text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint cooking_order_config_singleton_check
    check (config_key = 'default'),
  constraint cooking_order_config_schedule_check
    check (char_length(schedule_text) <= 120),
  constraint cooking_order_config_guide_check
    check (char_length(extra_guide) <= 1200)
);

insert into new_axe_net.cooking_order_types
  (type_key, label, short_label, detail, price_per_set, sort_order, enabled)
values
  ('1',  '1번 · 고기 O + 재료 O', '1번', '고기 + 재료 지참', 0,   10, true),
  ('2M', '2번 · 고기 O + 재료 X', '2번(고기 O)', '고기 지참 · 재료 미지참', 600, 20, true),
  ('2G', '2번 · 고기 X + 채집 O', '2번(채집 O)', '고기 미지참 · 채집 재료 지참', 600, 30, true),
  ('3',  '3번 · 고기 X + 재료 X', '3번', '고기 + 재료 미지참', 800, 40, true)
on conflict (type_key) do nothing;

insert into new_axe_net.cooking_order_config
  (config_key, schedule_text, extra_guide)
values
  (
    'default',
    '매주 화요일 / 목요일 / 토요일',
    E'수급 파악을 위해 고기와 재료는 주문 당일만 받습니다.\n\n여러 옵션을 동시에 선택해 각각 다른 SET 수량으로 주문할 수 있습니다.\n\n1 SET 기준\n고기 10 · 감자 3 · 양파 3 · 당근 3\n\n채집하면서 나온 바질/부추로 바질티/군만두를 만들 수 있으니 필요한 분들은 재료 주시고 SET당 200원에 구매하세요.'
  )
on conflict (config_key) do nothing;

create index if not exists cooking_order_types_sort_idx
on new_axe_net.cooking_order_types (sort_order, type_key);

alter table new_axe_net.cooking_order_types enable row level security;
alter table new_axe_net.cooking_order_config enable row level security;

revoke all on table new_axe_net.cooking_order_types from public, anon, authenticated;
revoke all on table new_axe_net.cooking_order_config from public, anon, authenticated;

grant usage on schema new_axe_net to authenticated, service_role;
grant select, insert, update, delete on table new_axe_net.cooking_order_types to service_role;
grant select, insert, update, delete on table new_axe_net.cooking_order_config to service_role;

create or replace function new_axe_net.get_cooking_order_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'config', coalesce((
      select to_jsonb(c) - 'updated_by'
      from new_axe_net.cooking_order_config c
      where c.config_key = 'default'
    ), '{}'::jsonb),
    'types', coalesce((
      select jsonb_agg(to_jsonb(t) - 'updated_by' order by t.sort_order, t.type_key)
      from new_axe_net.cooking_order_types t
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function new_axe_net.get_cooking_order_settings() from public, anon;
grant execute on function new_axe_net.get_cooking_order_settings() to authenticated;

create or replace function new_axe_net.save_cooking_order_type(
  p_type_key text,
  p_label text,
  p_short_label text,
  p_detail text,
  p_price_per_set integer,
  p_sort_order integer,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := btrim(coalesce(p_type_key, ''));
  v_label text := btrim(coalesce(p_label, ''));
  v_short text := btrim(coalesce(p_short_label, ''));
  v_detail text := btrim(coalesce(p_detail, ''));
  v_row new_axe_net.cooking_order_types%rowtype;
  v_enabled_count integer;
  v_existing_enabled boolean;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if v_label = '' then
    raise exception '메뉴 이름을 입력해 주세요.' using errcode = '22023';
  end if;

  if v_key = '' then
    v_key := 'm_' || substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 12);
  end if;

  if v_key !~ '^[A-Za-z0-9_-]{1,14}$' then
    raise exception '메뉴 내부 키 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;

  if v_short = '' then v_short := left(v_label, 50); end if;
  if char_length(v_label) > 100 then raise exception '메뉴 이름은 100자 이하로 입력해 주세요.' using errcode = '22023'; end if;
  if char_length(v_short) > 50 then raise exception '짧은 이름은 50자 이하로 입력해 주세요.' using errcode = '22023'; end if;
  if char_length(v_detail) > 100 then raise exception '설명은 100자 이하로 입력해 주세요.' using errcode = '22023'; end if;
  if coalesce(p_price_per_set, 0) < 0 or coalesce(p_price_per_set, 0) > 1000000000 then raise exception '가격을 확인해 주세요.' using errcode = '22023'; end if;
  if coalesce(p_sort_order, 0) < 0 or coalesce(p_sort_order, 0) > 9999 then raise exception '정렬 순서를 확인해 주세요.' using errcode = '22023'; end if;

  if coalesce(p_enabled, true) then
    select enabled into v_existing_enabled
    from new_axe_net.cooking_order_types
    where type_key = v_key;

    if not found or v_existing_enabled = false then
      select count(*) into v_enabled_count
      from new_axe_net.cooking_order_types
      where enabled = true;
      if v_enabled_count >= 25 then
        raise exception 'Discord 주문 메뉴는 최대 25개까지 사용할 수 있습니다.' using errcode = '22023';
      end if;
    end if;
  end if;

  insert into new_axe_net.cooking_order_types (
    type_key, label, short_label, detail, price_per_set, sort_order, enabled, updated_at, updated_by
  ) values (
    v_key, v_label, v_short, v_detail,
    coalesce(p_price_per_set, 0), coalesce(p_sort_order, 0), coalesce(p_enabled, true), now(), auth.uid()
  )
  on conflict (type_key) do update set
    label = excluded.label,
    short_label = excluded.short_label,
    detail = excluded.detail,
    price_per_set = excluded.price_per_set,
    sort_order = excluded.sort_order,
    enabled = excluded.enabled,
    updated_at = now(),
    updated_by = auth.uid()
  returning * into v_row;

  return to_jsonb(v_row) - 'updated_by';
end;
$$;

revoke all on function new_axe_net.save_cooking_order_type(text, text, text, text, integer, integer, boolean) from public, anon;
grant execute on function new_axe_net.save_cooking_order_type(text, text, text, text, integer, integer, boolean) to authenticated;

create or replace function new_axe_net.set_cooking_order_type_enabled(
  p_type_key text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row new_axe_net.cooking_order_types%rowtype;
  v_enabled_count integer;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if coalesce(p_enabled, false) = false then
    select count(*) into v_enabled_count
    from new_axe_net.cooking_order_types
    where enabled = true and type_key <> btrim(coalesce(p_type_key, ''));
    if v_enabled_count < 1 then
      raise exception '최소 1개의 주문 메뉴는 사용 상태로 남겨야 합니다.' using errcode = '22023';
    end if;
  else
    select count(*) into v_enabled_count
    from new_axe_net.cooking_order_types
    where enabled = true and type_key <> btrim(coalesce(p_type_key, ''));
    if v_enabled_count >= 25 then
      raise exception 'Discord 주문 메뉴는 최대 25개까지 사용할 수 있습니다.' using errcode = '22023';
    end if;
  end if;

  update new_axe_net.cooking_order_types
     set enabled = coalesce(p_enabled, false),
         updated_at = now(),
         updated_by = auth.uid()
   where type_key = btrim(coalesce(p_type_key, ''))
   returning * into v_row;

  if not found then
    raise exception '요리 메뉴를 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  return to_jsonb(v_row) - 'updated_by';
end;
$$;

revoke all on function new_axe_net.set_cooking_order_type_enabled(text, boolean) from public, anon;
grant execute on function new_axe_net.set_cooking_order_type_enabled(text, boolean) to authenticated;

create or replace function new_axe_net.save_cooking_order_config(
  p_schedule_text text,
  p_extra_guide text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule text := btrim(coalesce(p_schedule_text, ''));
  v_guide text := btrim(coalesce(p_extra_guide, ''));
  v_row new_axe_net.cooking_order_config%rowtype;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if char_length(v_schedule) > 120 then raise exception '운영 일정은 120자 이하로 입력해 주세요.' using errcode = '22023'; end if;
  if char_length(v_guide) > 1200 then raise exception '주문 안내는 1200자 이하로 입력해 주세요.' using errcode = '22023'; end if;

  insert into new_axe_net.cooking_order_config (
    config_key, schedule_text, extra_guide, updated_at, updated_by
  ) values (
    'default', v_schedule, v_guide, now(), auth.uid()
  )
  on conflict (config_key) do update set
    schedule_text = excluded.schedule_text,
    extra_guide = excluded.extra_guide,
    updated_at = now(),
    updated_by = auth.uid()
  returning * into v_row;

  return to_jsonb(v_row) - 'updated_by';
end;
$$;

revoke all on function new_axe_net.save_cooking_order_config(text, text) from public, anon;
grant execute on function new_axe_net.save_cooking_order_config(text, text) to authenticated;

notify pgrst, 'reload schema';
