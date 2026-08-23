# NEW AXE NET v1.21.0 — Home Workspace & Balance Polish

이번 버전은 v1.20.1의 사이트 구조를 유지하면서 **실제 홈 화면을 추가하고, 배너/로고를 홈 진입점으로 만들며 공금 상단 밸런스를 마감하는 버전**입니다.

## 핵심 변경

- 첫 진입 화면을 `홈`으로 변경
- 상단 NEW AXE NET 로고 클릭 → 홈
- AXE 배너 전체 클릭 → 홈
- 주요 메뉴를 `홈 / 멤버 / 공금`으로 구성
- 홈 화면 추가
  - 공용계좌 잔액
  - 활동/전체 멤버
  - 현재 회차 완료·미납·면제
  - 관리자 검수대기·보류
  - 자주 쓰는 화면 바로가기
  - 현재 회차 납부 완료율
  - 최근 공금 흐름
- 홈 데이터는 기존 members/fund 상태와 `recentLedger`를 재사용해 별도 API/DB 구조를 추가하지 않음
- 공금 상단 summary 비율을 `공용계좌 약 45% / 보조 지표 약 55%`로 재조정
- 공금 내부 탭 글씨와 간격을 소폭 키워 가독성 보정
- 공금내역의 `⋯` 수정 버튼을 명확한 `수정` 버튼으로 변경

## DB / SQL

**DB 변경 없음. Supabase SQL Editor에 입력할 내용 없음.**

## 적용

1. v1.21.0 ZIP 압축 해제
2. 기존 NEW AXE NET 프로젝트에 전체 덮어쓰기
3. GitHub Desktop Commit
4. Push
5. Vercel 자동배포 확인

설계 문서: `docs/HOME_WORKSPACE_1.0.md`

---

# NEW AXE NET v1.20.1 — Grid & Detail Polish

v1.20.0의 디자인 언어를 유지하면서 **공통 좌우 기준선 / 배너 중복 / 멤버 summary / 공금내역 디테일을 마감하는 버전**입니다.

## 핵심 변경

- 멤버와 공금 업무영역을 동일한 960px 중앙 workspace로 통일
- 공금의 월별현황 / 공금내역 / 검수대기에서 별도 900px nested max-width 제거
- 배너 안의 `NEW AXE NET` 중복 텍스트 제거, 브랜드 캡션 축약
- 멤버 summary rail을 4등분해 좌측 쏠림 제거
- 공금내역 메타 typography 미세 확대
- `직접` 배지를 보라색 대신 중성 gray 스타일로 변경
- 수정 action을 compact `⋯` 버튼으로 변경 (동작은 기존과 동일)
- 필터 초기화를 ghost control로 통일
- 날짜 그룹 경계를 강화해 ledger feed 가독성 개선

## DB / SQL

**DB 변경 없음. Supabase SQL Editor에 입력할 내용 없음.**

## 적용

1. v1.20.1 ZIP 압축 해제
2. 기존 NEW AXE NET 프로젝트에 전체 덮어쓰기
3. GitHub Desktop Commit
4. Push
5. Vercel 자동배포 확인

설계 문서: `docs/UNIFIED_UI_1.1.md`

---

# NEW AXE NET v1.20.0 — Unified UI Pass

이번 버전은 기능 추가가 아니라 **사이트 전체의 디자인 언어를 한 번에 맞추는 전역 UI 정돈 버전**입니다.

## 핵심 변경

- 배너와 `멤버 / 공금`을 하나의 사이트 헤더 구조로 결합
  - 중앙에 떠 있던 segmented menu 제거
  - 배너 바로 아래 full-width navigation rail
  - 선택 메뉴는 골드 underline
- 공금 내부 10개 메뉴도 capsule box를 제거하고 동일한 underline navigation으로 변경
- 업무영역의 `FUND MANAGEMENT / LEDGER` 같은 template형 영문 kicker 제거
- 멤버 화면을 기존 대형 panel/card 방식에서 공금과 같은 flat operations workspace로 전면 재구성
  - 기술문구 `Supabase · new_axe_net.members` 제거
  - 4개의 큰 KPI card를 얇은 summary rail로 변경
  - filter/search/table을 하나의 compact board로 통합
  - column width와 workspace width 고정으로 넓은 화면에서도 불필요하게 퍼지지 않음
- 공금 상단 summary도 card보다 얇은 정보 rail 형태로 변경
- 공금내역
  - 900px 중앙 ledger workspace
  - 필터 라벨을 select 안으로 통합 (`전체 이름 / 전체 구분 / 전체 계좌`)
  - 내역명/금액/메타의 글자 크기를 다시 올려 축소된 코드 UI 느낌 완화
- 공금 공통 form/card와 admin panel의 radius/높이/타이포도 같은 시스템으로 통일
- `AXE UI SYSTEM 3.0`으로 공통 control/radius/type token 재정리

## DB / SQL

**DB 변경 없음. Supabase SQL Editor에 입력할 내용 없음.**

## 적용

1. v1.20.0 ZIP 압축 해제
2. 기존 NEW AXE NET 프로젝트에 전체 덮어쓰기
3. GitHub Desktop Commit
4. Push
5. Vercel 자동배포 확인

## 검증

- JavaScript syntax check: PASS
- Relative import check: PASS
- CSS brace/structure check: PASS
- npm install은 실행환경 네트워크 제한으로 시간초과되어 production build는 이 환경에서 수행하지 못함

설계 문서: `docs/UNIFIED_UI_1.0.md`

---

# NEW AXE NET v1.19.0 — Fund UI Recomposition

이번 버전은 공금 기능을 추가하지 않고 **배너 / 사이트 카테고리 / 공금 워크스페이스 / 공금내역 / 증빙 뷰어의 시각 구조를 다시 설계**한 UI 리컴포지션 버전입니다.

## 핵심 변경

- 사이트 전체 중심축을 1120px로 통일하고, 공금 워크스페이스는 1040px / 공금내역은 940px로 단계적으로 좁혀 빈 공간을 줄임
- AXE 배너를 136px의 브랜드 헤더로 정돈하고 캡션을 작은 브랜드 플레이트 형태로 변경
- `멤버 / 공금` 대분류를 underline tab이 아니라 중앙의 segmented category navigation으로 재설계
- 공금 상단의 넓은 통계 rail을 `공용계좌 잔액 + 3개 보조 지표` 한 장의 compact summary로 재구성
- 공금 10개 탭을 별도 capsule navigation으로 묶고 일반 메뉴와 관리자 메뉴 사이에 구분선 추가
- `공금내역`의 7열 table을 제거하고 **날짜 그룹 + compact ledger feed**로 완전 재설계
  - 날짜는 하루에 한 번만 표시
  - 내역 / 구분 / 메모를 한 정보 블록으로 묶음
  - 관련자 / 주차 / 계좌를 한 정보 블록으로 묶음
  - 금액과 증빙/수정 액션은 우측에 고정
- 필터를 큰 표 헤더에서 분리해 작은 ledger toolbar로 재구성
- 증빙 보기를 정식 modal viewer로 재설계
  - 헤더 / 이미지 stage / footer
  - 원본 비율 유지
  - 원본 열기
  - ESC / backdrop 닫기
- 기존 기능의 data-action과 Supabase 로직은 변경하지 않음

## 적용

**SQL 변경 없음. Supabase SQL Editor에서 실행할 내용도 없습니다.**

기존 프로젝트에 전체 덮어쓰기 후 GitHub Desktop에서 Commit / Push 하면 됩니다.

## 설계 원칙

1. 넓은 화면을 억지로 채우지 않음
2. 데이터는 표보다 정보 묶음의 리듬을 우선
3. 브랜드 UI와 업무 UI의 역할을 분리
4. 골드는 활성 상태와 핵심 액션에만 사용
5. 화면별 임시 override 대신 canonical CSS 파일 자체를 수정

---

# NEW AXE NET v1.18.1 — Site Header Balance

v1.18.0 Operations Console의 업무영역은 유지하면서, 화면 상단을 **사이트형 계층**으로 재구성한 마이너 업데이트입니다.

## 변경

- 상단바에서 `멤버 / 공금` 메뉴를 제거하고 계정·상태만 남김
- 상단바 아래에 AXE 브랜드 배너를 복원
- 배너 아래에 `멤버 / 공금` 주 메뉴를 배치
- 전체 흐름을 `상단 유틸리티 → 배너 → 주 메뉴 → 업무영역`으로 고정
- 배너와 업무영역은 동일한 1180px 중앙축을 사용
- 배너는 기존 대형 Hero보다 낮은 154px로 제한해 운영화면 공간을 과도하게 먹지 않음
- 모바일에서는 배너 높이와 캡션을 자동 축소

## 적용

SQL 변경은 없습니다. 기존 프로젝트에 전체 덮어쓰기 후 Commit / Push 하면 됩니다.

---

# NEW AXE NET v1.18.0 — Operations Console Redesign

이번 버전은 기존 AXE 스타일을 계속 미세조정하는 대신, 업무 화면 자체를 **Modern Operations Console** 방식으로 재설계한 첫 기준본입니다.

## 이번 변경

- 좌측 사이드바 + 대형 Hero를 제거하고 **상단바 + 중앙 워크스페이스** 구조로 변경
- AXE 정체성은 로고/골드 활성선/주요 액션에만 사용
- 공금 상단 KPI 카드를 제거하고 한 줄형 **운영 요약 rail**로 변경
- 공금 탭을 카드형 버튼이 아닌 평평한 underline navigation으로 변경
- `월별현황`을 한 개의 데이터 surface 중심으로 재설계
- `공금내역` 11열을 정보 손실 없이 7열로 재배치
  - 구분/항목/방향/메모를 `내역` 셀의 2단 정보로 통합
  - 관련자/월·주차를 한 셀에 통합
- `검수대기`를 카드 묶음이 아니라 compact queue 형태로 재설계
- 기존 승인/보류/반려/일괄승인/증빙/수정 기능의 data-action은 유지
- DB 스키마 변경 없음

## 적용

이번 버전은 SQL 실행이 필요 없습니다. 기존 프로젝트에 전체 덮어쓰기 후 Commit/Push 하면 됩니다.

## 설계 원칙

1. 카드 안에 카드 금지
2. 화면 폭을 채우기 위한 빈 공간 금지
3. 목록/표가 주인공
4. 보조정보는 두 번째 줄로 압축
5. AXE 골드는 브랜드/선택/핵심 액션에만 사용
6. 모든 업무 surface는 중앙 기준

---

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
