# AXE TUBE · Supabase-first 1.0

- `sync_owner=legacy`: 기존 AXE TUBE / Apps Script 메타데이터가 원본
- `sync_owner=supabase`: AXE NET 메타데이터가 원본
- 멤버는 자신의 `writer_member_key` 영상만 수정/내리기 가능
- 관리자는 전체 영상 수정/내리기 가능
- 기존 미러 영상을 AXE NET에서 한 번이라도 수정/내리면 `sync_owner=supabase`로 승격
- BOT Mirror V3는 supabase-owned 영상의 metadata 및 active 상태를 보호하면서 legacy metrics delta만 계속 반영
