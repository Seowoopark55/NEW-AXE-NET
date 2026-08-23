# NEW AXE NET v1.25.0 · 공지사항 / 운영기준 이관 기준

## 목적

공금 모듈 다음 첫 일반 운영 모듈로 `공지사항 + 운영기준`을 Supabase-first 구조로 전환한다.
UI는 v1.24.0 AXE STYLE 4.0을 그대로 사용하며, 넓은 빈 공간을 만들기 위해 전체 workspace를 억지로 채우지 않는다.

## 기존 AXE NET 기준

### 공지사항

기존 화면은 하나의 `공지사항` 영역 안에서 다음 탭을 사용한다.

- 일반공지
- 패치노트
- 운영기준

공지 데이터는 다음 의미를 가진다.

- `id`
- `date`
- `type`
- `title`
- `content`
- `important`
- `writer`
- `updated_at`

기존 관리자는 공지를 등록 / 수정 / 삭제할 수 있다.

### 운영기준

기존 화면은 좌측 운영기준 목록과 우측 상세내용 구조이며, 다음 필드를 사용한다.

- `id`
- `category`
- `title`
- `content`
- `order`

목록은 `order` 숫자로 정렬한다.

## NEW AXE NET 데이터 구조

### `new_axe_net.notices`

| 기존 AXE NET | NEW AXE NET | 설명 |
| --- | --- | --- |
| id | legacy_id | 기존 데이터 이관용 원본 ID |
| date | published_at | 공지 작성/게시 시각 |
| type | notice_type | `일반공지` / `패치노트` |
| title | title | 제목 |
| content | content | 내용 |
| important | important | 중요 공지 여부 |
| writer | writer | 작성자 표시명 |
| updated_at | updated_at | 수정 시각 |

NEW 내부 PK는 bigint `id`를 별도로 사용한다. 삭제 시 실제 행을 제거하지 않고 `status='deleted'`로 내려서 실수 복구 가능성을 남긴다.

### `new_axe_net.operation_rules`

| 기존 AXE NET | NEW AXE NET | 설명 |
| --- | --- | --- |
| id | legacy_id | 기존 데이터 이관용 원본 ID |
| category | category | 분류 |
| title | title | 제목 |
| content | content | 상세 내용 |
| order | sort_order | 노출 순서 |

운영기준을 화면에서 내릴 때는 행을 삭제하지 않고 `active=false`로 처리한다.

## 브라우저 노출

base table은 anon/authenticated 브라우저에 직접 공개하지 않는다.
읽기 전용 projection만 공개한다.

- `notices_app`: published 공지만 노출
- `operation_rules_app`: active 운영기준만 노출

관리자 쓰기는 모두 `new_axe_net.is_admin()`을 다시 확인하는 security-definer RPC를 통해 처리한다.

## 관리자 RPC

- `save_notice`
- `delete_notice`
- `save_operation_rule`
- `delete_operation_rule`

일반 멤버 로그인은 서버 세션이므로 이 RPC를 사용할 수 없고, Supabase Auth 관리자만 실행할 수 있다.

## UI 기준

- 모듈 전체 최대 780px
- 공지 목록 실제 폭 720px
- 공지 상세 700px
- 운영기준 workspace 700px
  - 목록 238px
  - 상세 446px
  - gap 12px
- 상위 탭은 공금과 같은 underline 방식
- 중요 공지는 작은 경고 배지로만 강조
- 상세 본문은 카드 중첩보다 한 장의 문서처럼 표시

## 홈 연동

홈에는 최근 공지 4건을 연결한다.
중요 공지를 먼저 보여주고 같은 우선순위에서는 게시일 최신순으로 정렬한다.
행을 누르면 공지 모듈 상세로 바로 이동한다.

## 기존 데이터 이관

현재 패키지는 기존 Google Sheet의 실제 행 값을 임의 생성하지 않는다.
실제 행을 옮길 때는 다음 템플릿을 사용한다.

- `supabase/data/notices_import_template.csv`
- `supabase/data/operation_rules_import_template.csv`

Apps Script는 더 이상 이 모듈의 실시간 주 데이터 소스로 연결하지 않는다.
