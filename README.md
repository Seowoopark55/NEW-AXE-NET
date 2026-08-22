# NEW AXE NET v1.3

공금 신청 → 관리자 승인/거절 → 승인 시 원장 자동 생성 워크플로우입니다.

## 멤버 화면
공금 상단에 `납부 신청` 버튼이 추가됩니다.

신청 항목:
- 멤버
- Discord 사용자 ID
- 현재 선택 주차
- 신청 금액
- 입금 계좌
- 증빙 URL
- 메모

보안:
- 선택한 member_key의 DB Discord ID와 입력한 Discord ID가 일치해야 함
- 직접 fund_requests INSERT 권한은 없음
- 공개 RPC는 pending 요청 생성만 가능
- 이미 납부 완료/면제/중복 pending인 주차는 신청 불가

## 관리자 화면
공금 관리에 `요청` 탭 추가:
- 검토 대기 건수 표시
- 신청 상세 확인
- 승인
- 거절

승인:
- approve_fund_request()
- 동일 트랜잭션에서 create_fund_payment()
- fund_ledger에 active payment 생성
- fund_requests.status = approved
- LIVE ENGINE 즉시 완료/잔액 재계산

거절:
- 원장 생성 없음
- fund_requests.status = rejected
- 검토자/검토시간/거절메모 보존

## 적용
1. Supabase SQL Editor에서 `supabase/011_fund_requests_workflow.sql` 전체 실행
2. ZIP을 기존 NEW-AXE-NET 폴더에 덮어쓰기
3. GitHub Desktop → Commit → Push
4. Vercel 자동배포
5. 공금 → 납부 신청 테스트
6. 관리자 로그인 → 공금 관리 → 요청 → 승인/거절 확인

## 추가 CSV Import
없습니다.
