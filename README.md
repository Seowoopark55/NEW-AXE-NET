# NEW AXE NET v1.36.0

AXE TUBE의 최종 **Runtime Primary 전환** 단계입니다.

## 핵심 변경
- AXE TUBE 읽기/쓰기 기준 원본: NEW AXE NET Supabase
- Discord 포럼 원본: NEW AXE NET Supabase
- 기존 Apps Script / Google Sheet: NEW → Legacy 단방향 백업 전용
- legacy → Supabase 자동 흡수는 기본 OFF
- 기존 AXE TUBE에서 발생한 신규 변경은 기본적으로 NEW AXE NET에 다시 유입되지 않음
- 관리자 AXE TUBE 화면에 Discord/Sheet 백업 운영 상태 표시

## 이 버전에서 DB 변경
없음. 033 ~ 039가 이미 적용되어 있으면 추가 SQL을 실행하지 않습니다.

## BOT 적용
`AXE_BOT_TUBE_RUNTIME_PRIMARY_V1/index.js`를 AXE BOT의 `index.js`로 교체합니다.

기본값은 아래와 같습니다.
- `AXE_TUBE_FORUM_SOURCE=supabase`
- `AXE_TUBE_DISCORD_WRITE_MODE=supabase`
- `AXE_TUBE_LEGACY_PULL_MODE=off`
- `AXE_TUBE_FORUM_LEGACY_FALLBACK=false`

위 값들은 코드 기본값이므로 `.env`에 새로 추가할 필요가 없습니다.

## 긴급 롤백
과거처럼 기존 Apps Script/Sheet 변경까지 다시 Supabase에 흡수해야 할 때만:

`AXE_TUBE_LEGACY_PULL_MODE=mirror`

Discord 포럼 원본 자체를 기존 AXE TUBE로 되돌릴 때:

`AXE_TUBE_FORUM_SOURCE=legacy`

Supabase 조회 장애 시에만 legacy 자동 fallback을 허용하려면:

`AXE_TUBE_FORUM_LEGACY_FALLBACK=true`

정상 운영에서는 위 세 설정을 사용하지 않는 것을 권장합니다.

## 적용 순서
1. NEW AXE NET v1.36.0 배포
2. AXE BOT `index.js` 교체
3. `bash ~/deploy.sh`
4. Discord에서 `!튜브동기화`
5. `pm2 logs --lines 100`
6. 아래 로그 확인

`[AXE TUBE Runtime Primary] forum-source=supabase · legacy-pull=off · sheet-backup=outbound-only ...`

## 운영 원칙
이 시점부터 기존 AXE NET / Google Sheet AXE TUBE는 실시간 원본이 아닙니다.
기존 AXE TUBE 화면에서 직접 수정한 내용은 NEW AXE NET으로 자동 역수입되지 않습니다.
Google Sheet는 NEW AXE NET의 호환/백업 사본으로만 유지합니다.
