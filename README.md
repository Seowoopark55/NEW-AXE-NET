# NEW AXE NET v1.5 — 공금 운영 흐름 재설계

이번 버전은 기능 하나를 더 붙이는 버전이 아니라, 지금까지 만든 공금 기능을 **기존 AXE NET의 실제 운영 흐름 중심으로 재배치**한 버전입니다.

## 새 공금 메뉴
일반:
- 월별현황
- 공금납부
- 내 제출

관리자 추가:
- 검수대기
- 공금내역
- 잔액점검
- 공금설정

기존 개발자 명칭인 `원장`, `회비 규칙`, `공금 관리`를 메인 UI에서 제거했습니다.
DB 내부 테이블/함수명은 안정성을 위해 그대로 유지합니다.

## 월별현황
- 월 단위 주차 카드
- 완료 / 미납 / 면제 / 검수대기 건수
- 공용계좌 / 회사잔고 / 총 잔액
- 주차 선택 → 해당 주차 멤버 현황
- 최근 공금내역

## 공금납부
- 닉네임 + Discord 숫자 ID로 본인 확인
- 최근 주차별 본인 납부 상태
- 미납 주차만 선택 가능
- 금액은 해당 주차 공금액으로 고정
- 일반 멤버는 공용계좌 제출로 단순화
- 제출 → 검수대기

## 내 제출
- 본인 확인 후 자신의 제출만 조회
- 검수대기 / 승인 / 거절 / 삭제됨
- 제출시간 / 검수자 / 검수메모 / 증빙 확인

## 검수대기
- 관리자 독립 화면
- 대기 / 승인 / 거절 / 삭제 / 전체 필터
- 승인하면 기존처럼 fund_ledger payment 자동 생성

## 공금내역
- 기존 `원장` 명칭 제거
- 최대 1000건 조회
- 검색
- 납부/수입/지출/조정 필터
- 계좌 필터
- 정상/삭제 필터
- 월 필터
- 관리자 직접 납부 등록
- 수입·지출·조정 직접 등록
- 상세 수정 / 삭제 / 삭제내역 복구

## 잔액점검
- 시스템 계산 잔액 표시
- 실제 공용계좌 / 회사잔고 입력
- 차이 기록
- 점검자 / 시간 / 메모 이력 보존

## 공금설정
- 기존 `회비 규칙` → `주간 공금 설정`
- 면제관리 통합
- 납부 대상 기준 설명

## 코드 구조
기존의 거대한 fundView.js를 다시 분리했습니다.

- fundView.js : 화면 라우터/이벤트 바인딩
- fundService.js : Supabase API
- fundUtils.js : 공통 유틸
- components/fundNav.js
- components/shared.js
- views/overviewView.js
- views/paymentView.js
- views/submissionsView.js
- views/reviewView.js
- views/historyView.js
- views/balanceView.js
- views/settingsView.js
- fund.css

## 적용 순서
1. Supabase SQL Editor에서 `supabase/013_fund_workspace_reorg.sql` 전체 실행
2. ZIP을 기존 NEW-AXE-NET 폴더에 덮어쓰기
3. GitHub Desktop Commit → Push
4. Vercel 자동배포
5. 공금 탭 진입

## 추가 CSV Import
없습니다.

## 참고
일반 멤버의 정식 계정/로그인 체계는 아직 붙이지 않았기 때문에 `공금납부`와 `내 제출`은 현재 DB의 member_key + Discord 숫자 ID 일치 검증을 사용합니다. 관리자 로그인과는 별개입니다.
