# NEW AXE NET v1.2

공금 원장 쓰기 경로를 NEW AXE NET으로 전환하는 버전입니다.

## 추가 기능

관리자 `공금 관리 → 원장`

### 주간 공금 납부
- 멤버 선택
- 현재 선택 주차에 납부 등록
- 금액/계좌/처리일/메모
- 등록 즉시 LIVE ENGINE 완료 상태 반영
- 동일 멤버/주차 active payment 중복 방지

### 일반 원장
- 수입
- 지출
- 조정
- 공용계좌 / 회사잔고
- 관련 멤버 선택 가능
- 자유 분류와 메모
- 등록 즉시 잔액 반영

### 취소
- 원장 삭제 금지
- active → cancelled 처리
- 취소 후 잔액 및 주간 납부 상태 즉시 재계산
- 취소 사유는 fund_admin_audit_log에 보존

## DB 구조
신규 원장에는 legacy_id가 없으므로 fund_ledger.legacy_id는 nullable로 전환합니다.

entry_type은 앞으로:
- payment
- income
- expense
- adjustment
- refund

을 사용합니다.

## 적용
1. Supabase SQL Editor에서 `supabase/010_fund_ledger_write.sql` 전체 실행
2. ZIP을 기존 NEW-AXE-NET 폴더에 덮어쓰기
3. GitHub Desktop → Commit → Push
4. Vercel 자동배포
5. 관리자 로그인 → 공금 → 공금 관리 → 원장

## 추가 CSV Import
없습니다.
