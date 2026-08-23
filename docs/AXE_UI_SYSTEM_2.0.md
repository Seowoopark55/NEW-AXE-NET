# AXE UI SYSTEM 2.0

AXE NET의 실제 화면 비율을 기준으로 NEW AXE NET의 크기 체계를 고정한다.

## Shell
- max width: 1280px
- horizontal: `margin-inline:auto`
- main side padding: 18px
- hero minimum height: 184px

## Typography
- page title: 25px
- section title: 18px
- card title: 15px
- body/control: 13px
- label: 12px
- meta: 11.5px
- caption: 11px

## Controls
- input/select: 38px
- primary/normal button: 36px
- small button: 32px
- compact chip: 24px
- fund table head: 11.5px
- fund table body: 12.5px
- standard data row minimum: 44px

## Compact rule
글자 크기를 과도하게 줄여 압축하지 않는다.

우선순위:
1. 페이지 max-width 제한
2. 실제 데이터에 맞는 column width
3. gap 축소
4. padding 축소
5. 필요할 때만 상세영역 펼치기

## CSS ownership
- `src/styles/axe-ui-system.css`: 전역 크기 토큰
- `src/styles/main.css`: 앱 셸
- `src/modules/fund/fund.css`: 공금 공통/사용자 화면
- `src/modules/fund/views/overview.css`: 월별현황
- `src/modules/fund/views/admin.css`: 관리자 공금 화면

버전별 override 블록을 파일 끝에 누적하지 않는다. 수정할 때 기존 canonical rule 자체를 교체한다.
