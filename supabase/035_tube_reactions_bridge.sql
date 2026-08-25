-- AXE NET v1.31.0
-- 035_tube_reactions_bridge.sql
-- AXE TUBE 병행운영 반응/카운터 브리지
-- 전제: 033_tube_module.sql + 034_tube_legacy_import.sql 적용 완료
-- 목적:
-- 1) AXE NET 멤버 추천/비추천을 별도 기록
-- 2) 기존 AXE TUBE의 조회/추천/비추천 변화량을 Shadow Mirror로 합산
-- 3) 기존 카운터가 증가/감소해도 AXE NET에서 발생한 반응은 보존

alter table new_axe_net.tube_videos
  add column if not exists legacy_views integer,
  add column if not exists legacy_likes integer,
  add column if not exists legacy_dislikes integer;

alter table new_axe_net.tube_videos
  drop constraint if exists tube_videos_legacy_views_check,
  drop constraint if exists tube_videos_legacy_likes_check,
  drop constraint if exists tube_videos_legacy_dislikes_check;

alter table new_axe_net.tube_videos
  add constraint tube_videos_legacy_views_check
    check (legacy_views is null or legacy_views >= 0),
  add constraint tube_videos_legacy_likes_check
    check (legacy_likes is null or legacy_likes >= 0),
  add constraint tube_videos_legacy_dislikes_check
    check (legacy_dislikes is null or legacy_dislikes >= 0);

-- 034 최초 이관 시점의 정확한 기존 AXE TUBE 카운터를 baseline으로 저장합니다.
-- 이미 AXE NET에서 조회수가 증가했더라도 views 총계는 건드리지 않습니다.
with seed(tube_id, legacy_views, legacy_likes, legacy_dislikes) as (
  values
    ('tube_1778054050329_b85dc6a1', 51, 5, 0),
    ('tube_1778197194840_84d164d6', 25, 1, 0),
    ('tube_1778379199904_506eefb8', 31, 0, 0),
    ('tube_1779128515171_cc7bf740', 16, 3, 0),
    ('tube_1784510601180_b9f62261', 5, 1, 0),
    ('tube_1784544217066_8fae8088', 7, 0, 0),
    ('tube_1784706729458_f50201b2', 15, 0, 0),
    ('tube_1785277214141_3da07689', 5, 0, 0),
    ('tube_1785277257372_b9d48ecc', 5, 0, 0),
    ('tube_1785277617530_9bbfbe1d', 15, 0, 0),
    ('tube_1785558959531_17f337b5', 2, 0, 0),
    ('tube_1786097136946_111e84cb', 5, 0, 0)
)
update new_axe_net.tube_videos t
set
  legacy_views = s.legacy_views,
  legacy_likes = s.legacy_likes,
  legacy_dislikes = s.legacy_dislikes
from seed s
where t.tube_id = s.tube_id;

create table if not exists new_axe_net.tube_reactions (
  tube_id text not null
    references new_axe_net.tube_videos(tube_id)
    on update cascade on delete cascade,
  member_key text not null
    references new_axe_net.members(member_key)
    on update cascade on delete cascade,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tube_id, member_key)
);

create index if not exists tube_reactions_member_idx
  on new_axe_net.tube_reactions(member_key, updated_at desc);

create index if not exists tube_reactions_tube_idx
  on new_axe_net.tube_reactions(tube_id, reaction);

drop trigger if exists tube_reactions_touch_updated_at
on new_axe_net.tube_reactions;

create trigger tube_reactions_touch_updated_at
before update on new_axe_net.tube_reactions
for each row
execute function new_axe_net.touch_updated_at();

alter table new_axe_net.tube_reactions enable row level security;

revoke all on table new_axe_net.tube_reactions
from public, anon, authenticated;

grant select, insert, update, delete
on table new_axe_net.tube_reactions
to service_role;

-- 멤버 1명의 AXE NET 추천/비추천을 원자적으로 토글/변경합니다.
-- 브라우저에서 직접 호출하지 않고 member-session 서버 경로에서 service_role로만 호출합니다.
create or replace function new_axe_net.set_tube_reaction(
  p_tube_id text,
  p_member_key text,
  p_reaction text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tube_id text := nullif(btrim(coalesce(p_tube_id, '')), '');
  v_member_key text := nullif(btrim(coalesce(p_member_key, '')), '');
  v_requested text := nullif(lower(btrim(coalesce(p_reaction, ''))), '');
  v_existing text;
  v_next text;
  v_like_delta integer := 0;
  v_dislike_delta integer := 0;
  v_likes integer;
  v_dislikes integer;
begin
  if v_tube_id is null or v_member_key is null then
    raise exception '영상 또는 멤버 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;

  if v_requested is not null and v_requested not in ('like', 'dislike') then
    raise exception '반응 값이 올바르지 않습니다.' using errcode = '22023';
  end if;

  perform 1
  from new_axe_net.tube_videos
  where tube_id = v_tube_id and active = true
  for update;

  if not found then
    raise exception '영상을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  perform 1
  from new_axe_net.members
  where member_key = v_member_key and status = 'active';

  if not found then
    raise exception '현재 사용할 수 없는 멤버 계정입니다.' using errcode = '42501';
  end if;

  select reaction
    into v_existing
  from new_axe_net.tube_reactions
  where tube_id = v_tube_id
    and member_key = v_member_key
  for update;

  -- 같은 버튼을 다시 누르면 반응 취소, 다른 버튼이면 반응 변경입니다.
  if v_requested is null or v_existing = v_requested then
    v_next := null;
  else
    v_next := v_requested;
  end if;

  if v_existing = 'like' then v_like_delta := v_like_delta - 1; end if;
  if v_existing = 'dislike' then v_dislike_delta := v_dislike_delta - 1; end if;
  if v_next = 'like' then v_like_delta := v_like_delta + 1; end if;
  if v_next = 'dislike' then v_dislike_delta := v_dislike_delta + 1; end if;

  if v_next is null then
    delete from new_axe_net.tube_reactions
    where tube_id = v_tube_id
      and member_key = v_member_key;
  else
    insert into new_axe_net.tube_reactions(tube_id, member_key, reaction)
    values (v_tube_id, v_member_key, v_next)
    on conflict (tube_id, member_key)
    do update set reaction = excluded.reaction, updated_at = now();
  end if;

  update new_axe_net.tube_videos
  set
    likes = greatest(0, likes + v_like_delta),
    dislikes = greatest(0, dislikes + v_dislike_delta),
    updated_at = now()
  where tube_id = v_tube_id
  returning likes, dislikes into v_likes, v_dislikes;

  return jsonb_build_object(
    'tube_id', v_tube_id,
    'reaction', v_next,
    'likes', v_likes,
    'dislikes', v_dislikes
  );
end;
$$;

revoke all
on function new_axe_net.set_tube_reaction(text, text, text)
from public, anon, authenticated;

grant execute
on function new_axe_net.set_tube_reaction(text, text, text)
to service_role;

-- 기존 AXE TUBE 카운터를 AXE NET 총계에 '차이만' 반영합니다.
-- legacy_* baseline과 현재 원본 값의 signed delta를 적용하므로,
-- AXE NET에서 별도로 발생한 조회/추천/비추천은 덮어쓰지 않습니다.
create or replace function new_axe_net.apply_tube_legacy_metrics(
  p_tube_id text,
  p_views integer,
  p_likes integer,
  p_dislikes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tube_id text := nullif(btrim(coalesce(p_tube_id, '')), '');
  v_in_views integer := greatest(0, coalesce(p_views, 0));
  v_in_likes integer := greatest(0, coalesce(p_likes, 0));
  v_in_dislikes integer := greatest(0, coalesce(p_dislikes, 0));
  v_old_legacy_views integer;
  v_old_legacy_likes integer;
  v_old_legacy_dislikes integer;
  v_views integer;
  v_likes integer;
  v_dislikes integer;
begin
  select legacy_views, legacy_likes, legacy_dislikes
    into v_old_legacy_views, v_old_legacy_likes, v_old_legacy_dislikes
  from new_axe_net.tube_videos
  where tube_id = v_tube_id
  for update;

  if not found then
    raise exception '영상을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  update new_axe_net.tube_videos
  set
    views = case
      when v_old_legacy_views is null then greatest(views, v_in_views)
      else greatest(0, views + (v_in_views - v_old_legacy_views))
    end,
    likes = case
      when v_old_legacy_likes is null then greatest(likes, v_in_likes)
      else greatest(0, likes + (v_in_likes - v_old_legacy_likes))
    end,
    dislikes = case
      when v_old_legacy_dislikes is null then greatest(dislikes, v_in_dislikes)
      else greatest(0, dislikes + (v_in_dislikes - v_old_legacy_dislikes))
    end,
    legacy_views = v_in_views,
    legacy_likes = v_in_likes,
    legacy_dislikes = v_in_dislikes,
    updated_at = now()
  where tube_id = v_tube_id
  returning views, likes, dislikes into v_views, v_likes, v_dislikes;

  return jsonb_build_object(
    'tube_id', v_tube_id,
    'views', v_views,
    'likes', v_likes,
    'dislikes', v_dislikes,
    'legacy_views', v_in_views,
    'legacy_likes', v_in_likes,
    'legacy_dislikes', v_in_dislikes
  );
end;
$$;

revoke all
on function new_axe_net.apply_tube_legacy_metrics(text, integer, integer, integer)
from public, anon, authenticated;

grant execute
on function new_axe_net.apply_tube_legacy_metrics(text, integer, integer, integer)
to service_role;

notify pgrst, 'reload schema';

-- 검증
select
  count(*) as videos,
  count(*) filter (where legacy_views is not null) as legacy_baseline_ready,
  coalesce(sum(views), 0) as total_views,
  coalesce(sum(likes), 0) as total_likes,
  coalesce(sum(dislikes), 0) as total_dislikes
from new_axe_net.tube_videos
where active = true;
