-- NEW AXE NET v1.32.0
-- 036_tube_supabase_primary.sql
-- AXE TUBE Supabase-first 등록/수정/삭제 전환 기반
-- 전제: 033_tube_module.sql + 035_tube_reactions_bridge.sql 적용 완료
--
-- 핵심 원칙
-- - legacy : 기존 AXE TUBE/Apps Script가 메타데이터 원본인 행
-- - supabase : NEW AXE NET에서 생성되었거나, NEW AXE NET에서 수정/삭제되어
--              이후 기존 Shadow Mirror가 메타데이터/active를 되돌리면 안 되는 행
-- - 조회/추천/비추천의 legacy delta bridge는 sync_owner와 무관하게 계속 사용할 수 있습니다.

alter table new_axe_net.tube_videos
  add column if not exists sync_owner text;

update new_axe_net.tube_videos
set sync_owner = case
  when source like 'legacy%' then 'legacy'
  else 'supabase'
end
where sync_owner is null;

alter table new_axe_net.tube_videos
  alter column sync_owner set default 'legacy',
  alter column sync_owner set not null;

alter table new_axe_net.tube_videos
  drop constraint if exists tube_videos_sync_owner_check;

alter table new_axe_net.tube_videos
  add constraint tube_videos_sync_owner_check
  check (sync_owner in ('legacy', 'supabase'));

create index if not exists tube_videos_sync_owner_idx
  on new_axe_net.tube_videos(sync_owner, active, published_at desc);

create or replace function new_axe_net.save_tube_video_admin(
  p_tube_id text,
  p_title text,
  p_url text,
  p_youtube_video_id text,
  p_thumbnail_url text,
  p_content text default null,
  p_category text default '일반',
  p_writer_member_key text default null,
  p_writer text default null,
  p_writer_badge text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := nullif(btrim(coalesce(p_tube_id, '')), '');
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_video_id text := nullif(btrim(coalesce(p_youtube_video_id, '')), '');
  v_category text := coalesce(nullif(btrim(coalesce(p_category, '')), ''), '일반');
  v_writer text := coalesce(nullif(btrim(coalesce(p_writer, '')), ''), 'AXE');
  v_existing boolean := false;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  if v_title is null then
    raise exception '영상 제목을 입력하세요.' using errcode = '22023';
  end if;
  if char_length(v_title) > 100 then
    raise exception '영상 제목은 100자 이하로 입력하세요.' using errcode = '22023';
  end if;
  if v_url is null or v_video_id is null then
    raise exception '올바른 YouTube 영상 링크를 입력하세요.' using errcode = '22023';
  end if;
  if char_length(v_category) > 50 then
    raise exception '분류는 50자 이하로 입력하세요.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_content, '')) > 1500 then
    raise exception '설명은 1500자 이하로 입력하세요.' using errcode = '22023';
  end if;

  if v_id is not null then
    select exists(
      select 1 from new_axe_net.tube_videos where tube_id = v_id
    ) into v_existing;
  end if;

  if not v_existing then
    if v_id is null then
      v_id := 'tube_new_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    end if;

    insert into new_axe_net.tube_videos (
      tube_id,
      title,
      url,
      youtube_video_id,
      thumbnail_url,
      published_at,
      writer_member_key,
      writer,
      writer_badge,
      content,
      category,
      views,
      likes,
      dislikes,
      source,
      sync_owner,
      active
    ) values (
      v_id,
      v_title,
      v_url,
      v_video_id,
      nullif(btrim(coalesce(p_thumbnail_url, '')), ''),
      now(),
      nullif(btrim(coalesce(p_writer_member_key, '')), ''),
      v_writer,
      nullif(btrim(coalesce(p_writer_badge, '')), ''),
      nullif(btrim(coalesce(p_content, '')), ''),
      v_category,
      0,
      0,
      0,
      'new_axe_net',
      'supabase',
      true
    );
  else
    update new_axe_net.tube_videos
    set
      title = v_title,
      url = v_url,
      youtube_video_id = v_video_id,
      thumbnail_url = nullif(btrim(coalesce(p_thumbnail_url, '')), ''),
      writer_member_key = coalesce(nullif(btrim(coalesce(p_writer_member_key, '')), ''), writer_member_key),
      writer = v_writer,
      writer_badge = nullif(btrim(coalesce(p_writer_badge, '')), ''),
      content = nullif(btrim(coalesce(p_content, '')), ''),
      category = v_category,
      sync_owner = 'supabase',
      active = true,
      updated_at = now()
    where tube_id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function new_axe_net.deactivate_tube_video_admin(
  p_tube_id text
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

  update new_axe_net.tube_videos
  set
    active = false,
    sync_owner = 'supabase',
    updated_at = now()
  where tube_id = nullif(btrim(coalesce(p_tube_id, '')), '')
    and active = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all
on function new_axe_net.save_tube_video_admin(
  text,text,text,text,text,text,text,text,text,text
)
from public, anon;

grant execute
on function new_axe_net.save_tube_video_admin(
  text,text,text,text,text,text,text,text,text,text
)
to authenticated;

revoke all
on function new_axe_net.deactivate_tube_video_admin(text)
from public, anon;

grant execute
on function new_axe_net.deactivate_tube_video_admin(text)
to authenticated;

notify pgrst, 'reload schema';

select
  sync_owner,
  count(*) as videos,
  count(*) filter (where active) as active_videos
from new_axe_net.tube_videos
group by sync_owner
order by sync_owner;
