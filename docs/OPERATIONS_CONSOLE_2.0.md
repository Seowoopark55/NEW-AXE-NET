# AXE Operations Console 2.0

## Purpose

NEW AXE NET의 업무 UI가 넓은 개발자용 데이터 테이블처럼 보이지 않도록, 사이트 레이어와 운영 레이어의 시각 역할을 분리한다.

## Width hierarchy

- Site shell: 1120px
- Fund workspace: 1040px
- Ledger workspace: 940px
- Monthly matrix: 900px
- Review queue: 900px

콘텐츠가 짧을수록 중앙에 남고 남는 폭을 억지로 확장하지 않는다.

## Navigation

- Site category: centered segmented navigation
- Fund section: compact capsule navigation
- Active state: soft gold fill / border, no long underline

## Ledger

공금내역은 wide table이 아니라 날짜별 ledger feed를 사용한다.

- Date group
- Entry block: category + kind + type/direction/memo
- Person block: member + period/account
- Amount
- Evidence / edit actions

## Evidence viewer

증빙은 화면 중앙의 정식 viewer에서 원본 비율로 표시한다. 헤더와 footer를 분리해 개발용 lightbox 느낌을 제거한다.

## Data / DB

이 버전은 UI 재설계만 포함한다. DB schema, RPC, SQL migration 변경 없음.
