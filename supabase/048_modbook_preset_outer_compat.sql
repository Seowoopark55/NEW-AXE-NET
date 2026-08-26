-- AXE NET v1.47.1
-- 048: 추천세팅 겉옷 호환 판정 보정
-- 기존 데이터의 "겉옷/단독상의"를 outer(겉옷) 슬롯에서 정상적으로 선택/저장할 수 있게 합니다.

set search_path = new_axe_net, public;

create or replace function preset_modbook_supports_slot(p_parts text, p_slot_key text)
returns boolean
language sql
immutable
as $$
  with groups as (
    select trim(value) as part_group
    from unnest(regexp_split_to_array(coalesce(p_parts, ''), '\s*,\s*')) as u(value)
    where trim(value) <> ''
  )
  select case p_slot_key
    when 'outer' then exists (
      select 1
      from groups g
      where '겉옷' = any(regexp_split_to_array(g.part_group, '\s*/\s*'))
    )
    when 'top' then exists (select 1 from groups g where g.part_group = '상의')
    when 'bottom' then exists (select 1 from groups g where g.part_group = '하의')
    when 'shoes' then exists (select 1 from groups g where g.part_group = '신발')
    else false
  end;
$$;

create or replace function save_info_preset_post(
  p_id bigint,
  p_member_key text,
  p_nickname text,
  p_title text,
  p_description text,
  p_tags text[],
  p_slots jsonb,
  p_allow_override boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = new_axe_net, public
as $$
declare
  v_id bigint;
  v_owner text;
  v_slot jsonb;
  v_slot_key text;
  v_slot_label text;
  v_prefix_id bigint;
  v_suffix_id bigint;
  v_note text;
  v_type text;
  v_parts text;
begin
  if nullif(trim(coalesce(p_member_key, '')), '') is null then
    raise exception '멤버 정보가 없습니다.';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 1 or char_length(trim(coalesce(p_title, ''))) > 100 then
    raise exception '제목은 1~100자로 입력하세요.';
  end if;
  if char_length(coalesce(p_description, '')) > 4000 then
    raise exception '설명은 4000자 이하로 입력하세요.';
  end if;
  if jsonb_typeof(coalesce(p_slots, '[]'::jsonb)) <> 'array' then
    raise exception '장비 슬롯 정보가 올바르지 않습니다.';
  end if;

  if p_id is null then
    insert into info_preset_posts (
      author_member_key, author_nickname, title, description, tags, active, created_at, updated_at
    ) values (
      p_member_key,
      coalesce(nullif(trim(p_nickname), ''), 'AXE'),
      trim(p_title),
      coalesce(p_description, ''),
      coalesce(p_tags, '{}'::text[]),
      true,
      now(),
      now()
    ) returning id into v_id;
  else
    select author_member_key into v_owner
    from info_preset_posts
    where id = p_id;

    if not found then
      raise exception '수정할 추천세팅 게시글을 찾을 수 없습니다.';
    end if;
    if coalesce(v_owner, '') <> p_member_key and not p_allow_override then
      raise exception '본인이 작성한 추천세팅만 수정할 수 있습니다.';
    end if;

    update info_preset_posts
    set title = trim(p_title),
        description = coalesce(p_description, ''),
        tags = coalesce(p_tags, '{}'::text[]),
        active = true,
        updated_at = now()
    where id = p_id;

    v_id := p_id;
    delete from info_preset_post_slots where post_id = v_id;
  end if;

  for v_slot in select * from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb))
  loop
    v_slot_key := trim(coalesce(v_slot->>'slot_key', ''));
    if v_slot_key not in ('outer','top','bottom','shoes') then
      raise exception '지원하지 않는 장비 부위입니다: %', v_slot_key;
    end if;
    v_slot_label := preset_slot_label(v_slot_key);

    v_prefix_id := nullif(v_slot->>'prefix_modbook_id', '')::bigint;
    v_suffix_id := nullif(v_slot->>'suffix_modbook_id', '')::bigint;
    v_note := left(coalesce(v_slot->>'note', ''), 500);

    if v_prefix_id is not null then
      select type, parts into v_type, v_parts
      from info_modbooks
      where id = v_prefix_id and active = true;
      if not found then raise exception '선택한 접두 개조서를 찾을 수 없습니다.'; end if;
      if v_type <> '접두' then raise exception '접두 슬롯에는 접두 개조서만 선택할 수 있습니다.'; end if;
      if not preset_modbook_supports_slot(v_parts, v_slot_key) then
        raise exception '% 부위에 적용할 수 없는 접두 개조서입니다.', v_slot_label;
      end if;
    end if;

    if v_suffix_id is not null then
      select type, parts into v_type, v_parts
      from info_modbooks
      where id = v_suffix_id and active = true;
      if not found then raise exception '선택한 접미 개조서를 찾을 수 없습니다.'; end if;
      if v_type <> '접미' then raise exception '접미 슬롯에는 접미 개조서만 선택할 수 있습니다.'; end if;
      if not preset_modbook_supports_slot(v_parts, v_slot_key) then
        raise exception '% 부위에 적용할 수 없는 접미 개조서입니다.', v_slot_label;
      end if;
    end if;

    insert into info_preset_post_slots (
      post_id, slot_key, prefix_modbook_id, suffix_modbook_id, note, updated_at
    ) values (
      v_id, v_slot_key, v_prefix_id, v_suffix_id, v_note, now()
    );
  end loop;

  if not exists (
    select 1 from info_preset_post_slots s
    where s.post_id = v_id
      and (s.prefix_modbook_id is not null or s.suffix_modbook_id is not null)
  ) then
    raise exception '개조서를 하나 이상 선택하세요.';
  end if;

  return v_id;
end;
$$;


revoke all on function preset_modbook_supports_slot(text,text) from public, anon, authenticated;
grant execute on function preset_modbook_supports_slot(text,text) to service_role;
revoke all on function save_info_preset_post(bigint,text,text,text,text,text[],jsonb,boolean) from public, anon, authenticated;
grant execute on function save_info_preset_post(bigint,text,text,text,text,text[],jsonb,boolean) to service_role;
