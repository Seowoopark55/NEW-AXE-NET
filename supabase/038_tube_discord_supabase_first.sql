-- NEW AXE NET v1.34.0
-- 038_tube_discord_supabase_first.sql
-- AXE TUBE의 신규 입력을 Supabase-first로 확정하고,
-- 기존 Apps Script / Google Sheet를 NEW AXE NET의 단방향 백업 경로로 유지합니다.
-- 전제: 033 ~ 037 적용 완료

alter table new_axe_net.tube_videos
  add column if not exists legacy_backup_id text,
  add column if not exists legacy_backup_status text not null default 'none',
  add column if not exists legacy_backup_synced_at timestamptz,
  add column if not exists legacy_backup_error text;

alter table new_axe_net.tube_videos
  drop constraint if exists tube_videos_legacy_backup_status_check;

alter table new_axe_net.tube_videos
  add constraint tube_videos_legacy_backup_status_check
  check (legacy_backup_status in ('none', 'legacy_source', 'pending', 'synced', 'error', 'deleted'));

-- 기존 Apps Script/Sheet에서 이관된 행은 그 자체가 레거시 원본입니다.
-- 비밀번호 원문을 보유하지 않으므로 NEW AXE NET이 이 백업 행을 수정/삭제하려고 하지 않습니다.
update new_axe_net.tube_videos
set
  legacy_backup_id = coalesce(legacy_backup_id, tube_id),
  legacy_backup_status = 'legacy_source',
  legacy_backup_synced_at = coalesce(legacy_backup_synced_at, source_updated_at, created_at),
  legacy_backup_error = null
where source like 'legacy%'
  and legacy_backup_status = 'none';

-- v1.32~v1.33에서 NEW AXE NET에 새로 생성된 영상도 다음 BOT 동기화에서
-- 기존 Sheet 백업을 만들 수 있도록 pending으로 올립니다.
update new_axe_net.tube_videos
set
  legacy_backup_status = 'pending',
  legacy_backup_error = null
where sync_owner = 'supabase'
  and source in ('new_axe_net', 'discord_supabase_primary')
  and legacy_backup_status = 'none';

create unique index if not exists tube_videos_legacy_backup_id_uidx
  on new_axe_net.tube_videos(legacy_backup_id)
  where legacy_backup_id is not null;

create index if not exists tube_videos_legacy_backup_status_idx
  on new_axe_net.tube_videos(legacy_backup_status, active, updated_at desc);

-- NEW AXE NET이 관리하는 신규 영상의 메타데이터/활성 상태가 바뀌면
-- Sheet 백업 동기화를 pending으로 되돌립니다.
-- legacy_source는 원래 레거시 행의 비밀번호 원문이 없으므로 자동 백업 갱신 대상에서 제외합니다.
create or replace function new_axe_net.mark_tube_legacy_backup_pending()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.sync_owner = 'supabase'
       and new.source in ('new_axe_net', 'discord_supabase_primary') then
      new.legacy_backup_status := 'pending';
      new.legacy_backup_error := null;
    end if;
    return new;
  end if;

  if old.legacy_backup_status = 'legacy_source' then
    return new;
  end if;

  if new.sync_owner = 'supabase'
     and new.source in ('new_axe_net', 'discord_supabase_primary')
     and (
       new.title is distinct from old.title
       or new.url is distinct from old.url
       or new.thumbnail_url is distinct from old.thumbnail_url
       or new.writer is distinct from old.writer
       or new.writer_badge is distinct from old.writer_badge
       or new.content is distinct from old.content
       or new.category is distinct from old.category
       or new.active is distinct from old.active
     ) then
    new.legacy_backup_status := 'pending';
    new.legacy_backup_error := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tube_videos_mark_legacy_backup_pending
on new_axe_net.tube_videos;

create trigger tube_videos_mark_legacy_backup_pending
before insert or update on new_axe_net.tube_videos
for each row
execute function new_axe_net.mark_tube_legacy_backup_pending();

notify pgrst, 'reload schema';

select
  legacy_backup_status,
  count(*) as videos
from new_axe_net.tube_videos
group by legacy_backup_status
order by legacy_backup_status;
