# AXE NET · OUTLAW MODULE 1.0

## 범위

v1.29.0은 기존 AXE NET의 다음 4개 시트를 AXE NET Supabase 구조로 이관한다.

- 무법지대통계: 19명 현재값
- 무법지대통계기록: 472건 히스토리
- 브리핑맵: 17개 지역
- 무법지대공략: 3개 지역 / 10개 단계

## AXE NET 구조

### outlaw_stats_current
현재 누적 킬/데스와 K/D. member_key가 authority이며 기존 Discord ID는 향후 AXE BOT 연동 키로 보존한다.

### outlaw_stats_history
누적 통계의 시계열 기록. 통계값·증가량·Discord message_id·기록시각을 보존하며 legacy record_id는 `legacy_<message_id>`로 안정적으로 생성한다.
OCR 원문은 새 웹의 통계 계산에 사용되지 않고 472건 전체를 장기 보관할 실익이 낮아 legacy import에서 제외했다.
Discord CDN signed image URL도 만료형이므로 legacy import에서 제외했다.

### outlaw_guide_locations / outlaw_guide_steps
반복되던 공략 지역 정보와 단계 정보를 정규화했다.

### outlaw_briefing_maps
브리핑맵 17개를 관리한다. coord는 페리코의 `????` 같은 값도 보존해야 하므로 text다.

## 접근 권한

- anon: 직접 조회 불가
- 일반 멤버: HttpOnly member session -> `/api/member-session` -> service role
- 관리자: Supabase Auth + `is_admin()` RLS

무법지대는 전술 정보가 포함되므로 INFO 모듈과 달리 멤버 전용으로 운영한다.

## 이미지

CSV에는 이미지 파일명만 있고 실제 PNG 원본은 제공되지 않았다.
웹은 `/public/assets/outlaw/`를 참조하며 파일이 없으면 `IMAGE NOT MIGRATED` placeholder를 표시한다.
이미지 확보 후 파일명 그대로 해당 폴더에 넣으면 DB/코드 수정 없이 즉시 표시된다.

## 다음 단계

현재 통계는 2026-08-23 CSV snapshot이다. 실시간 authority 전환은 AXE BOT의 무법지대 OCR 저장 경로를 Google Sheet/Apps Script에서 `new_axe_net.outlaw_stats_current` + `outlaw_stats_history`로 전환하는 후속 작업에서 완료한다.
