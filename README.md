# NEW AXE NET v1.32.0

AXE TUBE Supabase-first 운영 전환 단계입니다.

## 변경사항
- 멤버 로그인: 본인 영상 등록 / 수정 / 내리기
- 관리자 로그인: 전체 영상 등록 / 수정 / 내리기
- 기존 AXE TUBE 미러 영상도 NEW AXE NET에서 수정하는 순간 `sync_owner=supabase`로 전환
- AXE BOT Mirror V3가 `sync_owner=supabase` 영상의 메타데이터/active 상태를 기존 Apps Script 값으로 되돌리지 않도록 보호
- 기존 조회/추천/비추천 legacy delta bridge는 그대로 유지

## 적용 순서
1. `supabase/036_tube_supabase_primary.sql` 실행
2. NEW AXE NET v1.32.0 배포
3. AXE BOT TUBE Mirror V3 `index.js` 배포
4. `!튜브동기화` 실행 후 로그에서 `metrics=bridge-v3` 확인

## 주의
이번 단계는 NEW AXE NET을 AXE TUBE 메타데이터의 새 원본으로 사용할 수 있게 만드는 단계입니다.
NEW AXE NET에서 새로 만든/수정한 영상 내용을 기존 Google Sheet/옛 AXE NET으로 역미러링하는 기능은 아직 넣지 않았습니다.
