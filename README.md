# NEW AXE NET v1.4

공금 원장 운영 관리 고도화 버전입니다.

## 추가 기능

### 원장 수정
관리자 `공금 관리 → 원장`에서 active 원장에 `수정` 버튼이 생깁니다.

주간 공금 납부:
- 금액
- 계좌
- 처리일
- 메모

수정 가능.

멤버/납부 주차는 LIVE ENGINE의 상태 계산 기준이므로 잠급니다.
잘못된 멤버/주차는 해당 원장을 삭제하고 올바르게 다시 등록합니다.

일반 원장:
- 수입 / 지출 / 조정
- 계좌
- 금액
- 처리일
- 관련 멤버
- 분류
- 메모

수정 가능.

### 원장 삭제
회계 데이터는 실제 DELETE 하지 않습니다.

`삭제`를 누르면:
- status = cancelled
- deleted_at
- deleted_by
- delete_reason

을 기록합니다.

삭제 즉시:
- 전체 잔액 재계산
- 납부 payment인 경우 주간 완료 상태 재계산
- 승인 요청에서 생성된 payment라면 해당 request도 deleted 처리

### 삭제 원장 복구
삭제된 항목에 `복구` 버튼이 생깁니다.
payment 복구 시 같은 멤버/주차의 다른 active payment가 있으면 복구를 막습니다.

### 요청 ↔ 원장 연결
v1.4부터 승인된 NEW 공금 신청은 fund_ledger.request_id로 명시적으로 연결합니다.
v1.3에서 이미 승인된 요청도 audit log를 이용해 가능한 항목은 자동 backfill합니다.

### 감사 로그
- update_ledger
- delete_ledger
- restore_ledger

이 `fund_admin_audit_log`에 남습니다.

## 적용
1. Supabase SQL Editor에서 `supabase/012_fund_ledger_edit_delete.sql` 전체 실행
2. ZIP을 기존 NEW-AXE-NET 폴더에 덮어쓰기
3. GitHub Desktop → Commit → Push
4. Vercel 자동배포
5. 관리자 로그인 → 공금 → 공금 관리 → 원장

## 추가 CSV Import
없습니다.
