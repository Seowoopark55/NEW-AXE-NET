-- AXE NET v1.29.2
-- 032_outlaw_admin_management.sql
-- 무법지대 공략 / 브리핑맵 관리자 관리 RPC
-- 전제: 030_outlaw_module.sql 적용 완료

create or replace function new_axe_net.save_outlaw_guide_location(
  p_location_key text,
  p_map_name text,
  p_main_image text default null,
  p_coord text default null,
  p_sort_order integer default 0
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := nullif(btrim(coalesce(p_location_key, '')), '');
  v_name text := nullif(btrim(coalesce(p_map_name, '')), '');
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if v_key is null then
    raise exception '지역 키를 입력하세요.' using errcode = '22023';
  end if;
  if v_key !~ '^[a-z0-9][a-z0-9_-]{0,49}$' then
    raise exception '지역 키는 영문 소문자, 숫자, -, _ 만 사용할 수 있습니다.' using errcode = '22023';
  end if;
  if v_name is null then
    raise exception '지역명을 입력하세요.' using errcode = '22023';
  end if;

  insert into new_axe_net.outlaw_guide_locations (
    location_key, map_name, main_image, coord, active, sort_order
  ) values (
    v_key,
    v_name,
    nullif(btrim(coalesce(p_main_image, '')), ''),
    nullif(btrim(coalesce(p_coord, '')), ''),
    true,
    coalesce(p_sort_order, 0)
  )
  on conflict (location_key) do update
  set map_name = excluded.map_name,
      main_image = excluded.main_image,
      coord = excluded.coord,
      active = true,
      sort_order = excluded.sort_order,
      updated_at = now();

  return v_key;
end;
$$;

create or replace function new_axe_net.deactivate_outlaw_guide_location(
  p_location_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  update new_axe_net.outlaw_guide_locations
  set active = false,
      updated_at = now()
  where location_key = p_location_key
    and active = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function new_axe_net.save_outlaw_guide_step(
  p_id bigint,
  p_location_key text,
  p_route_group text,
  p_step_no text,
  p_title text,
  p_content text default null,
  p_image text default null,
  p_video_url text default null,
  p_sort_order integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_location_key text := nullif(btrim(coalesce(p_location_key, '')), '');
  v_route_group text := coalesce(nullif(btrim(coalesce(p_route_group, '')), ''), '기본 루트');
  v_step_no text := nullif(btrim(coalesce(p_step_no, '')), '');
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if v_location_key is null or not exists (
    select 1 from new_axe_net.outlaw_guide_locations l
    where l.location_key = v_location_key and l.active = true
  ) then
    raise exception '공략 지역을 선택하세요.' using errcode = '22023';
  end if;
  if v_step_no is null then
    raise exception '단계 번호를 입력하세요.' using errcode = '22023';
  end if;
  if v_title is null then
    raise exception '단계 제목을 입력하세요.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into new_axe_net.outlaw_guide_steps (
      location_key, route_group, step_no, title, content, image, video_url,
      sort_order, active
    ) values (
      v_location_key,
      v_route_group,
      v_step_no,
      v_title,
      nullif(btrim(coalesce(p_content, '')), ''),
      nullif(btrim(coalesce(p_image, '')), ''),
      nullif(btrim(coalesce(p_video_url, '')), ''),
      coalesce(p_sort_order, 0),
      true
    ) returning id into v_id;
  else
    update new_axe_net.outlaw_guide_steps
    set location_key = v_location_key,
        route_group = v_route_group,
        step_no = v_step_no,
        title = v_title,
        content = nullif(btrim(coalesce(p_content, '')), ''),
        image = nullif(btrim(coalesce(p_image, '')), ''),
        video_url = nullif(btrim(coalesce(p_video_url, '')), ''),
        sort_order = coalesce(p_sort_order, 0),
        active = true,
        updated_at = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception '수정할 공략 단계를 찾을 수 없습니다.' using errcode = 'P0002';
    end if;
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception '같은 지역/루트에 동일한 단계 번호가 이미 있습니다.' using errcode = '23505';
end;
$$;

create or replace function new_axe_net.deactivate_outlaw_guide_step(
  p_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  update new_axe_net.outlaw_guide_steps
  set active = false,
      updated_at = now()
  where id = p_id
    and active = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function new_axe_net.save_outlaw_briefing_map(
  p_map_key text,
  p_map_name text,
  p_image text default null,
  p_description text default null,
  p_note text default null,
  p_coord text default null,
  p_source_updated_at date default null,
  p_sort_order integer default 0
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := nullif(btrim(coalesce(p_map_key, '')), '');
  v_name text := nullif(btrim(coalesce(p_map_name, '')), '');
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if v_key is null then
    raise exception '맵 키를 입력하세요.' using errcode = '22023';
  end if;
  if v_key !~ '^[a-z0-9][a-z0-9_-]{0,49}$' then
    raise exception '맵 키는 영문 소문자, 숫자, -, _ 만 사용할 수 있습니다.' using errcode = '22023';
  end if;
  if v_name is null then
    raise exception '맵 이름을 입력하세요.' using errcode = '22023';
  end if;

  insert into new_axe_net.outlaw_briefing_maps (
    map_key, map_name, image, description, note, coord,
    source_updated_at, active, sort_order
  ) values (
    v_key,
    v_name,
    nullif(btrim(coalesce(p_image, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    nullif(btrim(coalesce(p_coord, '')), ''),
    p_source_updated_at,
    true,
    coalesce(p_sort_order, 0)
  )
  on conflict (map_key) do update
  set map_name = excluded.map_name,
      image = excluded.image,
      description = excluded.description,
      note = excluded.note,
      coord = excluded.coord,
      source_updated_at = excluded.source_updated_at,
      active = true,
      sort_order = excluded.sort_order,
      updated_at = now();

  return v_key;
end;
$$;

create or replace function new_axe_net.deactivate_outlaw_briefing_map(
  p_map_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  update new_axe_net.outlaw_briefing_maps
  set active = false,
      updated_at = now()
  where map_key = p_map_key
    and active = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function new_axe_net.save_outlaw_guide_location(text,text,text,text,integer)
from public, anon;
grant execute on function new_axe_net.save_outlaw_guide_location(text,text,text,text,integer)
to authenticated;

revoke all on function new_axe_net.deactivate_outlaw_guide_location(text)
from public, anon;
grant execute on function new_axe_net.deactivate_outlaw_guide_location(text)
to authenticated;

revoke all on function new_axe_net.save_outlaw_guide_step(bigint,text,text,text,text,text,text,text,integer)
from public, anon;
grant execute on function new_axe_net.save_outlaw_guide_step(bigint,text,text,text,text,text,text,text,integer)
to authenticated;

revoke all on function new_axe_net.deactivate_outlaw_guide_step(bigint)
from public, anon;
grant execute on function new_axe_net.deactivate_outlaw_guide_step(bigint)
to authenticated;

revoke all on function new_axe_net.save_outlaw_briefing_map(text,text,text,text,text,text,date,integer)
from public, anon;
grant execute on function new_axe_net.save_outlaw_briefing_map(text,text,text,text,text,text,date,integer)
to authenticated;

revoke all on function new_axe_net.deactivate_outlaw_briefing_map(text)
from public, anon;
grant execute on function new_axe_net.deactivate_outlaw_briefing_map(text)
to authenticated;

notify pgrst, 'reload schema';
