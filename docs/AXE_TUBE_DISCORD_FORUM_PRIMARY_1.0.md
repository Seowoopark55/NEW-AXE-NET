# NEW AXE NET v1.33.0

AXE TUBE Discord 포럼을 NEW AXE NET Supabase 기준으로 동기화하는 단계입니다.

## 변경사항
- AXE TUBE 영상에 Discord 포럼 동기화 상태 저장
- 웹 카드/상세/편집창에서 `Discord 연동 / 대기 / 보관 / 오류` 상태 표시
- 영상 등록/수정/내리기 시 Discord 동기화 상태를 `pending`으로 전환
- AXE BOT Forum Primary V1이 기존 Apps Script 데이터를 먼저 Supabase에 미러링한 뒤, 최종 Discord 포럼 화면은 Supabase 활성 영상 목록을 기준으로 생성/수정
- NEW AXE NET에서 새로 등록한 영상도 다음 BOT 자동 동기화 때 Discord 포럼 게시글 자동 생성
- NEW AXE NET에서 내린 영상은 Discord 포럼에서 자동 보관(archive), 다시 활성화되면 자동 복원
- Supabase 연결 문제 시 기존 Apps Script 목록으로 포럼 동기화를 fallback 하여 운영 중단 방지

## 적용 순서
1. `supabase/037_tube_discord_forum_primary.sql` 실행
2. NEW AXE NET v1.33.0 배포
3. AXE BOT `AXE_BOT_TUBE_FORUM_PRIMARY_V1/index.js` 배포
4. `!튜브동기화` 실행
5. BOT 로그에서 `forum-source=supabase` 확인

## 롤백
긴급 시 BOT `.env`에 `AXE_TUBE_FORUM_SOURCE=legacy`를 추가하고 재시작하면 Discord 포럼만 기존 Apps Script 기준으로 되돌릴 수 있습니다. 기존 데이터 저장 구조는 건드리지 않습니다.

## 아직 유지되는 레거시
Discord 등록 버튼은 기존 Apps Script 등록 성공 후 Supabase에 미러링하는 안전 경로를 그대로 유지합니다. 기존 AXE NET / Google Sheet 역방향 쓰기는 아직 제거하지 않습니다.
