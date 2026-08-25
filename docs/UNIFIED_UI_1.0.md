# AXE NET · Unified UI 1.0

v1.20.0부터 사이트 외곽과 업무화면을 하나의 시각 규칙으로 묶는다.

## 구조

1. Top utility bar
2. AXE brand banner
3. Banner-attached module navigation
4. Centered workspace
5. Flat operational surfaces

## Navigation

- `멤버 / 공금`은 배너 아래에 붙는 사이트용 navigation rail이다.
- 선택 메뉴는 카드/캡슐이 아니라 골드 underline으로 구분한다.
- 공금 10개 하위 메뉴도 동일한 underline navigation을 사용한다.

## Typography

- 큰 영문 kicker를 업무영역에 반복하지 않는다.
- 페이지 제목 18~22px
- 핵심 데이터 13~18px
- 일반 목록 11.5~13px
- 보조 정보 10~11px
- 10px 미만은 연도/미세 메타처럼 정말 비핵심 정보에만 사용한다.

## Density

- 넓은 화면을 채우기 위한 확장을 하지 않는다.
- 사이트 shell 1120px, fund workspace 1000px, ledger 900px를 기본 축으로 사용한다.
- 멤버 workspace는 1040px다.
- 테이블/리스트는 역할별 column width를 갖고 중앙에 남는다.

## Surfaces

- 카드 안의 카드 구조를 줄인다.
- 요약 정보는 큰 KPI card 대신 얇은 rail을 우선한다.
- Radius는 7~10px 위주로 사용한다.
- 골드는 선택 상태와 핵심 action에만 사용한다.

## v1.20.0 적용 범위

- Banner + module navigation
- Members list workspace
- Fund mast / summary / section navigation
- Fund ledger title, filter bar, row typography
- Public fund workflow shared cards/controls
- Fund admin shared panel headings

기능 로직과 DB schema는 변경하지 않는다.
