# NEW AXE NET v0.9

공금 모듈 1차 이전 버전입니다.

## v0.9
- 좌측 메뉴에 `공금` 모듈 추가
- 기존 공금 데이터를 NEW schema로 분리 이전
- 전체/공용계좌/회사잔고 잔액 표시
- 주차 선택
- 주차별 완료/미납/면제/예정 현황
- 멤버별 주간 상태
- 최근 active 원장 12건
- 원본 공금 테이블은 브라우저에 직접 노출하지 않고 공개 RPC만 사용

## 데이터 이전
SQL 실행 후 `supabase/data` 폴더의 CSV 5개를 각 NEW 테이블에 Import합니다.

1. fund_fee_rules_import.csv → new_axe_net.fund_fee_rules
2. fund_exemptions_import.csv → new_axe_net.fund_exemptions
3. fund_status_snapshot_import.csv → new_axe_net.fund_status_snapshot
4. fund_requests_import.csv → new_axe_net.fund_requests
5. fund_ledger_import.csv → new_axe_net.fund_ledger

기존 fund_members CSV는 import하지 않습니다.
현재 18행이 NEW members의 active 18명과 정확히 같아 중복 상태이므로 members를 기준으로 사용합니다.

## 적용 순서
1. `supabase/007_fund_base.sql` 실행
2. 위 CSV 5개 Import
3. ZIP을 NEW-AXE-NET 폴더에 덮어쓰기
4. GitHub Desktop → Commit → Push
5. Vercel 자동 배포
6. 좌측 `공금` 메뉴 확인

## 현재 단계
v0.9의 주간 상태는 기존 Supabase 계산 결과를 snapshot으로 보존해 표시합니다.
다음 단계에서 fund_ledger + fund_fee_rules + fund_exemptions + members를 기준으로
NEW AXE NET 자체 계산 엔진을 만들 예정입니다.
