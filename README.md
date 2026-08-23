# NEW AXE NET v1.30.0

Supabase `new_axe_net` 기반 신규 AXE 운영 웹.

## v1.30.0
- AXE TUBE 1차 모듈 추가
- 기존 AXE_TUBE.csv 12개 영상 이관 SQL
- YouTube형 영상 피드 / 상세 재생 / 검색 / 분류 / 정렬
- 공개 상세 열람 시 Supabase 조회수 +1
- 기존 AXE TUBE 쓰기/Discord/Apps Script 경로는 변경하지 않음
- 레거시 게시글 password 해시는 NEW AXE NET에 이관하지 않음

## SQL 적용 순서
1. `supabase/033_tube_module.sql`
2. `supabase/034_tube_legacy_import.sql`

기존 `001~032`가 적용되어 있는 프로젝트에서 이어서 실행합니다.
