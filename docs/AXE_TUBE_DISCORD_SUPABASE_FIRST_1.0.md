# AXE TUBE Discord Supabase-first 1.0

Discord 등록 경로를 `Supabase → Discord Forum → legacy backup` 순서로 변경합니다.
기존 Apps Script/Sheet는 제거하지 않고 백업 및 기존 AXE NET 호환 경로로 유지합니다.

중복 방지는 `tube_videos.legacy_backup_id`로 처리합니다. legacy 전체 동기화가 백업 행을 다시 읽더라도 해당 ID를 NEW AXE NET의 primary `tube_id`로 매핑하여 별도 행을 만들지 않습니다.
