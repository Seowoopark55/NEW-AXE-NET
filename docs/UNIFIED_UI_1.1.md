# AXE NET — Unified UI 1.1

v1.20.1은 v1.20.0의 디자인 방향을 유지하면서 **정렬 기준선과 시각적 리듬을 고정하는 마감 패스**입니다.

## 공통 기준선

- 사이트 배너: 1120px 중앙
- 실제 업무 workspace: 960px 중앙
- 멤버 / 공금 workspace는 동일한 960px 기준선 사용
- 공금 하위 화면은 별도의 900px nested max-width를 두지 않고 부모 workspace 폭을 그대로 사용
- 필요한 내부 여백은 component padding으로 처리

## 배너

- 상단 로고의 `AXE NET`과 배너 안의 동일 문구가 중복되던 구조 제거
- 배너 캡션은 `AXE OPERATIONS NETWORK / OPERATIONS / MEMBERS · FUND`로 축약
- 배경 AXE 그래픽이 브랜드의 주인공이 되도록 텍스트 비중 축소

## 멤버

- workspace를 공금과 동일한 960px로 통일
- 전체 / 활동 / 비활성 / 퇴사 summary rail을 4등분하여 좌측 쏠림 제거
- 모바일에서는 기존처럼 수평 스크롤 가능한 compact stat strip으로 전환

## 공금

- 공금관리 헤더 / summary / 내부 메뉴 / 실제 view가 같은 960px 좌우 기준선을 사용
- 월별현황 / 공금내역 / 검수대기의 900px nested width 제거

## 공금내역

- 날짜의 연도 및 서브 메타 글씨를 미세하게 확대
- `직접` 배지를 보라색에서 중성 gray 계열로 변경
- `승인`은 AXE gold outline 계열 유지
- 증빙은 기존 compact action 유지
- 수정 버튼은 `⋯` action으로 단순화 (기존 편집 기능 그대로)
- 필터 초기화를 ghost button으로 정리
- 날짜 그룹 경계선을 조금 더 명확하게 조정

## DB / SQL

DB 변경 없음. Supabase SQL Editor에 입력할 내용 없음.
