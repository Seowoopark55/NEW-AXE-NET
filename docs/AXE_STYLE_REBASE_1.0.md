# AXE STYLE REBASE 1.0

## 목적

v1.23까지 남아 있던 문제는 화면별로 `gap`을 몇 px씩 줄이는 수준이 아니었다.
공금내역, 요율관리, 멤버관리처럼 정보량이 적은 행이 공통 960px 작업축을 끝까지 채우도록 설계되어 있어, 정보 사이에 비정상적으로 큰 빈 공간이 생겼다.

이번 리베이스는 **버전별 CSS 덧댐을 추가하지 않고 현재 canonical style 자체를 정리**하는 작업이다.
기존 AXE NET이 지향하는 `내용 폭 중심 / 작은 데이터셋을 억지로 늘리지 않음 / 중앙정렬 / 짧은 행 / 명확한 액션`을 NEW AXE NET의 구조 규칙으로 고정한다.

## 감사 결과

### 1. 실제 원인: 중복 selector보다 `stretch geometry`

정확히 같은 selector가 여러 fund CSS 파일에서 서로 덮어쓰는 구조는 현재 발견되지 않았다.
주된 원인은 canonical rule 자체에 남아 있던 `minmax(..., 1fr)`였다.

대표 예:

- 공금내역: `minmax(260px,1fr) 168px 104px 92px`
- 검수대기: 넓은 identity 영역 + 전체폭 queue
- 요율 이력: 메모 열 `1fr`
- 공금 멤버관리: 멤버 identity 열 `minmax(...,1fr)`

즉 브라우저가 남는 공간을 첫 정보열에 모두 배분하면서, 실제 데이터는 왼쪽에 있는데 다음 정보는 멀리 밀려나는 구조였다.

### 2. 구조적 부채도 존재

실행 중인 UI와 관계없는 구형 CSS가 남아 있었다.

- `main.css`의 구형 sidebar / hero / utility shell
- `main.css`의 구형 members list/table/search
- `admin.css`의 구형 11열 ledger/table CSS
- 사용되지 않는 `settingsView.js`
- 일부 `!important` specificity patch

이 코드들이 이번 넓은 간격의 직접 원인은 아니었지만, 이후 수정 시 어느 파일이 실제 owner인지 판단하기 어렵게 만드는 구조적 부채였다.
이번 버전에서 제거했다.

## 새 레이아웃 원칙

### 사이트 축

- Site shell: 1120px
- Operations workspace: 960px
- 상위 workspace는 **정렬 기준선**일 뿐, 내부 리스트가 전부 960px를 써야 한다는 뜻이 아니다.

### 내용 기반 폭

- 공금내역: 780px
- 검수대기: 640px
- 잔액점검: 최대 820px
- 요율관리 전체: 최대 700px
  - 등록 폼: 640px
  - 적용 이력: 530px
- 멤버관리 전체: 최대 700px
  - 실제 리스트 패널: 640px
- 정합성점검: 최대 860px
- 면제관리: 실제 두 패널 폭의 합만 사용하고 전체폭으로 stretch하지 않는다.

모든 축소된 화면은 가운데 정렬한다.

## 주요 행 geometry

### 공금내역

```css
grid-template-columns: 330px 150px 96px 84px;
```

내역 / 관련자 / 금액 / 액션이 정보량만큼만 공간을 차지한다.

### 검수대기

```css
grid-template-columns: 24px 315px 110px 52px 50px;
```

체크 / 제출자·주차 / 금액 / 상태 / 증빙 순서로 고정한다.

### 요율 이력

```css
grid-template-columns: 92px 240px 56px 64px;
```

적용시점 / 금액·메모 / 상태 / 액션 사이에 빈 `1fr`이 없다.

### 공금 멤버관리

```css
grid-template-columns: 240px 84px 100px 76px 58px;
```

멤버 / 대상 / 가입일 / 상태 / 관리 열을 실제 데이터 크기에 맞게 고정한다.

## CSS 소유권

현재 UI의 canonical owner는 다음과 같다.

- `src/styles/main.css`
  - 전역 primitive
  - 인증
  - 멤버 detail/create/edit 공용 레거시 interaction
  - **사이트 shell이나 fund layout을 소유하지 않음**
- `src/styles/axe-ui-system.css`
  - 공통 폭/폰트/컨트롤/token
- `src/styles/operations-shell.css`
  - 현재 site topbar / banner / primary nav / main shell
- `src/modules/home/home.css`
  - 홈
- `src/modules/members/operations-members.css`
  - 멤버 목록 workspace
- `src/modules/fund/fund.css`
  - 공금 공통/사용자 workflow
- `src/modules/fund/operations-console.css`
  - 공금 shell / 월별현황 / 공금내역 / 검수대기
- `src/modules/fund/views/admin.css`
  - 잔액 / 요율 / 면제 / 정합성 / 공금 멤버관리

버전별 별도 override CSS는 만들지 않는다.
수정은 해당 canonical owner의 원래 rule을 직접 바꾼다.

## 제거한 구조적 부채

- 구형 `.app-shell`, `.sidebar`, `.brand__*`, `.nav__item`, `.main__wrap`, `.utility-bar`, `.hero-banner*`
- 구형 members stats / toolbar / search / table CSS
- 구형 fund ledger/table CSS
- unused `settingsView.js`
- canonical UI CSS의 `!important`

`main.css`는 v1.23 기준 1384줄에서 897줄로 축소되었다.
`admin.css`는 v1.23 기준 약 595줄에서 403줄로 축소되었다.

## 재발 방지

`npm run audit:styles`를 추가했다.

감사 항목:

- `main.css`에 fund selector가 다시 들어오지 않는지
- 구형 shell/member/fund ledger token이 돌아오지 않는지
- unused `settingsView.js`가 돌아오지 않는지
- canonical UI CSS에 `!important`가 추가되지 않는지
- 서로 다른 CSS 파일이 같은 exact selector를 동시에 소유하지 않는지
- 저밀도 desktop 행에 `1fr` stretch column이 다시 생기지 않는지

## DB / 기능

이번 리베이스는 표현 구조와 CSS ownership만 수정한다.
공금 RPC, 승인/보류/반려, 증빙, 정합성 복구, 멤버 설정 등 기능과 DB 스키마는 변경하지 않는다.
따라서 추가 SQL은 없다.
