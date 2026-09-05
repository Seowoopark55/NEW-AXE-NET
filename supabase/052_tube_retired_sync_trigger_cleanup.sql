-- AXE NET CLEAN BASELINE · 2026-09-05
-- AXE TUBE는 웹 전용으로 유지합니다.
-- 퇴역한 Discord Forum Sync / Legacy Backup 자동 pending 처리만 제거합니다.
-- 데이터/컬럼/인덱스/CHECK 제약조건은 보존합니다.

begin;

drop trigger if exists tube_videos_mark_discord_pending
  on new_axe_net.tube_videos;

drop trigger if exists tube_videos_mark_legacy_backup_pending
  on new_axe_net.tube_videos;

-- CASCADE를 사용하지 않습니다. 예기치 않은 의존성이 있으면 삭제가 중단됩니다.
drop function if exists new_axe_net.mark_tube_discord_pending();
drop function if exists new_axe_net.mark_tube_legacy_backup_pending();

notify pgrst, 'reload schema';

commit;
