# NEW AXE NET v1.34.0

AXE TUBE Discord 등록을 **Supabase-first**로 전환하는 단계입니다.

## 변경사항
- Discord AXE TUBE 영상 등록 버튼의 1차 저장 원본을 NEW AXE NET Supabase로 전환
- Supabase 저장 성공 후 Discord 포럼 게시글 생성
- 기존 Apps Script / Google Sheet는 NEW AXE NET 신규 영상의 단방향 백업으로 실행
- NEW AXE NET 웹에서 새로 등록한 영상도 BOT 자동 동기화가 Sheet 백업을 생성
- NEW AXE NET에서 백업 대상 영상을 수정/내리면 Sheet 백업도 update/delete로 따라감
- 백업 ID를 `legacy_backup_id`로 매핑하여 기존 Sheet 재조회 시 중복 영상 생성 방지
- 백업 실패 시 NEW AXE NET/Discord 등록은 유지되고 `Sheet 백업 오류` 상태만 기록
- BOT 자동 동기화가 `pending/error` 백업을 재시도
- 기존 Apps Script에서 직접 등록된 영상은 계속 legacy → Supabase Shadow Mirror 유지
- 웹 상세/편집창에서 Discord 연동 상태와 Sheet 백업 상태 확인 가능

## 적용 순서
1. `supabase/038_tube_discord_supabase_first.sql` 실행
2. NEW AXE NET v1.34.0 배포
3. AXE BOT `AXE_BOT_TUBE_SUPABASE_PRIMARY_V1/index.js` 배포
4. Discord에서 `!튜브동기화` 실행
5. 테스트 영상 1건 등록 후 BOT 로그 확인

## 필수 환경변수
기존 값을 그대로 사용합니다. 새 필수 환경변수는 없습니다.
- `NEW_AXE_NET_SUPABASE_URL`
- `NEW_AXE_NET_SUPABASE_SECRET_KEY`
- `APPS_SCRIPT_URL`

## 긴급 롤백
BOT `.env`에 아래 값을 추가하고 재시작하면 Discord 등록만 기존 Apps Script-first 방식으로 되돌릴 수 있습니다.

```env
AXE_TUBE_DISCORD_WRITE_MODE=legacy
```

Discord 포럼 원본 롤백은 기존과 동일하게 `AXE_TUBE_FORUM_SOURCE=legacy`를 사용할 수 있습니다.
