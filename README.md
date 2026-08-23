# NEW AXE NET v1.17.0 — FUND REBASE

기존 AXE NET 최신 공금 운영본을 **UI/UX·기능 명세서**로 고정하고, NEW AXE NET 공금 모듈을 그 기준에 맞춰 다시 정렬한 리베이스 버전입니다.

## 이번 버전의 원칙
- 기존 AXE NET의 화면 밀도, 정보 우선순위, 공금 탭 구성, 사용 흐름을 우선합니다.
- NEW의 차별점은 화면을 임의로 바꾸는 것이 아니라 **모듈 구조·Supabase 중심 데이터 구조·보안·유지보수성**에 둡니다.
- 화면이 좁거나 콘텐츠가 짧아도 좌측에 붙지 않도록 작업영역을 중앙 정렬합니다.
- 컴팩트함은 작은 글씨가 아니라 `max-width / column width / gap / padding`으로 만듭니다.
- 버전별 CSS override를 계속 덧붙이지 않고 현재 파일이 해당 영역의 canonical style을 소유합니다.

## v1.17.0 변경

### 1. 전체 작업영역 중앙정렬
- 우측 메인 영역 안에 `.main__wrap` 1280px 중앙 컨테이너 도입
- utility / hero / module root가 같은 중심축 사용
- 공금 하위 화면도 용도별 최대폭을 갖고 가운데 정렬

### 2. AXE UI SYSTEM 2.0
- 기존 AXE NET 실제 수치를 기준으로 공통 타이포/컨트롤 토큰 재정리
- 페이지 제목 25px
- 기본 본문/컨트롤 13px
- 메타 11.5px
- input/select 38px
- 일반 버튼 36px
- 공금 기본 표 12.5px / 헤더 11.5px

### 3. 공금 공통 셸
- 기존 AXE NET과 같은 `공금관리` 헤더/설명 구조
- 상단 요약: `공용계좌 계산 잔액 / 전체 검수대기·보류 / 선택월 승인 건 / 활성 면제`
- 공금 탭: `월별현황 / 공금납부 / 내 제출 / 검수대기 / 공금내역 / 잔액점검 / 요율관리 / 면제관리 / 정합성점검 / 멤버관리`

### 4. 검수대기 패리티
- `검수대기 + 보류`를 하나의 작업 큐로 표시
- 오래된 제출부터 정렬
- 전체 선택 / 선택 일괄승인
- 개별 승인 / 보류 / 반려
- 검수 메모/반려 사유 입력
- 증빙 보기

### 5. 공금내역 패리티
- 월 선택 + `지출/수입 등록`
- 최신 AXE NET 방식대로 자유검색창 제거
- `이름 / 구분 / 계좌` 선택 필터 + 초기화
- 11열 표 복원: `날짜 / 구분 / 항목 / 관련자 / 월·주차 / 금액 / 방향 / 계좌 / 증빙 / 메모 / 관리`
- `직접기입 / 승인반영` 배지
- 수정 모달 유지
- NEW의 안전 삭제/복구 기능은 보조 관리 기능으로 유지

### 6. 월별현황 canonical CSS
- 테이블을 내용 폭 중심으로 중앙정렬
- 멤버명/주차 셀 폭 고정으로 AXE NET 특유의 밀도 재현
- 사용자가 제거 요청한 마지막 `미납 합계` 열은 NEW에서 복구하지 않음

### 7. 기간 면제 기능
- 멤버 선택
- 시작 월 / 시작 주차
- 종료 월 / 종료 주차
- 사유
- 기간 전체 면제 저장
- 활성 면제 기간 중복 차단
- 해당 기간의 검수대기·보류·승인 신청 충돌 차단
- 기간 단위 일괄 해제

DB live engine 호환을 위해 실제 저장은 주차별 행으로 하되 `range_key`로 하나의 기간 등록 건을 묶습니다.

### 8. DB 검수 흐름
`019_fund_rebase_parity.sql`에서 다음을 함께 적용합니다.
- `hold` 상태
- pending + hold 중복 제출 차단
- hold → 승인 / 반려
- 선택 일괄승인 RPC
- 월별현황/정합성점검의 pending + hold 처리
- 기간 면제 RPC

### 9. 누적 CSS 제거
- `src/styles/main.css`에 남아 있던 v0.9~v1.4 구형 공금 CSS 블록을 제거
- 공금 스타일 소유권을 `fund.css / overview.css / views/admin.css`로만 한정
- 예전 규칙과 새 규칙이 동시에 같은 `.fund-*` 클래스를 건드리는 구조를 제거
- 이후 공금 UI 수정은 canonical rule 자체를 수정하고 버전별 override를 추가하지 않음

## 적용 순서
1. Supabase SQL Editor에서 `supabase/019_fund_rebase_parity.sql` 전체 실행
2. v1.17.0 소스를 기존 NEW AXE NET 프로젝트에 전체 덮어쓰기
3. GitHub Desktop Commit / Push
4. Vercel 자동배포 확인

## 환경변수
추가 환경변수는 없습니다.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용

## CSV
추가 Import는 없습니다.

## 문서
- `docs/AXE_NET_FUND_REBASE_1.0.md`
- `docs/AXE_UI_SYSTEM_2.0.md`
- 기존 패리티 계획: `docs/AXE_NET_PARITY_PLAN.md`
