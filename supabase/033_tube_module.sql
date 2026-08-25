-- AXE NET v1.30.0
-- 033_tube_module.sql
-- AXE TUBE 1차 기반: 기존 영상 이관 + 공개 조회 + 조회수 증가
-- 새 영상 작성/수정/댓글/추천 쓰기는 아직 기존 AXE TUBE 흐름을 유지합니다.

create schema if not exists new_axe_net;
grant usage on schema new_axe_net to anon, authenticated, service_role;

create table if not exists new_axe_net.tube_videos (
  tube_id text primary key,
  title text not null,
  url text not null,
  youtube_video_id text,
  thumbnail_url text,
  published_at timestamptz not null,
  writer_member_key text
    references new_axe_net.members(member_key)
    on update cascade on delete set null,
  writer text not null default 'AXE',
  writer_badge text,
  content text,
  category text not null default '일반',
  sort_order integer not null default 0,
  views integer not null default 0 check (views >= 0),
  likes integer not null default 0 check (likes >= 0),
  dislikes integer not null default 0 check (dislikes >= 0),
  source_updated_at timestamptz,
  source text not null default 'new_axe_net',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tube_videos_active_published_idx
  on new_axe_net.tube_videos (active, published_at desc);
create index if not exists tube_videos_category_idx
  on new_axe_net.tube_videos (category, active, published_at desc);
create index if not exists tube_videos_writer_idx
  on new_axe_net.tube_videos (writer_member_key, active, published_at desc);

-- 기존 공통 updated_at trigger 함수 사용
drop trigger if exists tube_videos_touch_updated_at
on new_axe_net.tube_videos;
create trigger tube_videos_touch_updated_at
before update on new_axe_net.tube_videos
for each row
execute function new_axe_net.touch_updated_at();

alter table new_axe_net.tube_videos enable row level security;

revoke all on table new_axe_net.tube_videos
from public, anon, authenticated;

grant select on table new_axe_net.tube_videos to anon, authenticated;
grant select, insert, update, delete on table new_axe_net.tube_videos to service_role;

-- 기존 AXE TUBE는 비밀번호를 제외한 영상 목록을 공개 제공해 왔으므로
-- AXE NET 1차도 active 영상의 읽기만 공개합니다.
drop policy if exists tube_videos_public_read
on new_axe_net.tube_videos;
create policy tube_videos_public_read
on new_axe_net.tube_videos
for select to anon, authenticated
using (active = true);

-- 조회수는 기존 AXE TUBE와 동일하게 공개 상세 열람 시 +1만 허용합니다.
-- 직접 UPDATE 권한은 열지 않고 이 RPC만 노출합니다.
create or replace function new_axe_net.increment_tube_view(
  p_tube_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_views integer;
begin
  update new_axe_net.tube_videos
     set views = views + 1,
         updated_at = now()
   where tube_id = nullif(btrim(coalesce(p_tube_id, '')), '')
     and active = true
  returning views into v_views;

  if v_views is null then
    raise exception '영상을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  return v_views;
end;
$$;

revoke all on function new_axe_net.increment_tube_view(text)
from public;
grant execute on function new_axe_net.increment_tube_view(text)
to anon, authenticated;

notify pgrst, 'reload schema';
