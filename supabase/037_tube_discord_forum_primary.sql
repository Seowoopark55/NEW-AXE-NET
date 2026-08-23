-- NEW AXE NET v1.33.0
-- 037_tube_discord_forum_primary.sql
-- AXE TUBE Discord 포럼을 NEW AXE NET Supabase 기준으로 동기화하기 위한 상태 컬럼
-- 전제: 033 ~ 036 적용 완료

alter table new_axe_net.tube_videos
  add column if not exists discord_thread_id text,
  add column if not exists discord_sync_status text not null default 'pending',
  add column if not exists discord_synced_at timestamptz,
  add column if not exists discord_sync_error text,
  add column if not exists discord_archived_by_sync boolean not null default false;

alter table new_axe_net.tube_videos
  drop constraint if exists tube_videos_discord_sync_status_check;

alter table new_axe_net.tube_videos
  add constraint tube_videos_discord_sync_status_check
  check (discord_sync_status in ('pending', 'synced', 'archived', 'error'));

update new_axe_net.tube_videos
set discord_sync_status = case
  when active = false then 'archived'
  when nullif(btrim(coalesce(discord_thread_id, '')), '') is not null then 'synced'
  else 'pending'
end
where discord_sync_status is null
   or discord_sync_status not in ('pending', 'synced', 'archived', 'error');

create index if not exists tube_videos_discord_sync_idx
  on new_axe_net.tube_videos(discord_sync_status, active, updated_at desc);


create or replace function new_axe_net.mark_tube_discord_pending()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.discord_sync_status := 'pending';
    new.discord_synced_at := null;
    new.discord_sync_error := null;
    return new;
  end if;

  if new.title is distinct from old.title
     or new.url is distinct from old.url
     or new.published_at is distinct from old.published_at
     or new.thumbnail_url is distinct from old.thumbnail_url
     or new.writer is distinct from old.writer
     or new.writer_badge is distinct from old.writer_badge
     or new.content is distinct from old.content
     or new.category is distinct from old.category
     or new.active is distinct from old.active then
    new.discord_sync_status := 'pending';
    new.discord_synced_at := null;
    new.discord_sync_error := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tube_videos_mark_discord_pending
on new_axe_net.tube_videos;

create trigger tube_videos_mark_discord_pending
before insert or update on new_axe_net.tube_videos
for each row
execute function new_axe_net.mark_tube_discord_pending();

notify pgrst, 'reload schema';

select
  discord_sync_status,
  count(*) as videos
from new_axe_net.tube_videos
group by discord_sync_status
order by discord_sync_status;
