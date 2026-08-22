# NEW AXE NET v1.0

공금 모듈의 Supabase-first 실시간 계산 전환 버전입니다.

## 핵심 변경
v0.9까지는 이전한 `fund_status_snapshot`을 화면에 표시했습니다.

v1.0부터는 snapshot을 계산 원본에서 제거하고 다음 4개 데이터만으로 주간 상태를 실시간 계산합니다.

- members
- fund_fee_rules
- fund_exemptions
- fund_ledger

## 검증
기존 fund_status 324행과 새 계산 로직을 전 행 비교했고 324/324 일치했습니다.

## 적용
1. Supabase SQL Editor에서 `supabase/008_fund_live_engine.sql` 전체 실행
2. ZIP을 기존 NEW-AXE-NET 폴더에 덮어쓰기
3. GitHub Desktop → Commit → Push
4. Vercel 자동 배포
5. 공금 화면에서 LIVE ENGINE 표시 확인

## 추가 Import
없습니다.

`fund_status_snapshot`은 삭제하지 않습니다.
과거 이전 결과 검증용으로만 보존합니다.
