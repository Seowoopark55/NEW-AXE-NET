# NEW AXE NET · 회사자산 / 반납 레거시 이관 1.0

버전: v1.28.1

## 원본

- `supabase/data/company_assets_legacy_source.csv`
  - 회사자산 22건
- `supabase/data/company_asset_returns_legacy_source.csv`
  - 퇴사자반납 3건

원본 CSV는 이관 추적용으로만 포함하며 NEW AXE NET 런타임에서는 읽지 않습니다.

## 정규화

### 회사자산
- `개인 부담 비용`의 `$`, `,`, `-`를 제거하여 bigint 또는 NULL로 저장
- 기존 `YY/MM` 취득일은 해당 월 1일로 저장
  - 예: `26/01` → `2026-01-01`
- 화면에서는 legacy 행의 월 단위 원본 특성을 반영해 `YYYY-MM`로 표시
- 원본 상태값 `보유중`, `미배정 총기`는 그대로 유지
- `미배정` 3건은 특정 멤버에 연결하지 않음

### 멤버 연결
- 원본 보유자명과 현재 `new_axe_net.members.nickname`을 연결
- 원본 `야미`는 현재 닉네임 `얌이`로 명시적으로 연결
- 회사자산 22건 중 19건 member_key 연결 / 3건 미배정

### 퇴사자반납
- `05/03`, `06/09`는 2026년의 MM/DD 형식으로 해석
  - `05/03` → `2026-05-03`
  - `06/09` → `2026-06-09`
- `2026-08-17`은 그대로 유지
- 3건 모두 member_key 연결
- 과거 반납 기록은 현재 보유 자산과 잘못 묶이지 않도록 `asset_id=NULL`로 이관

## 실행

`supabase/028_assets_legacy_import.sql`

026 이후 실행합니다. `legacy_no`가 이미 존재하면 해당 행을 갱신하고, 없으면 삽입하므로 같은 028을 다시 실행해도 중복 행이 생기지 않습니다.

## 기대 검증값

- imported_assets: 22
- linked_assets: 19
- unlinked_assets: 3
- personal_cost_total: 1,350,001
- imported_returns: 3
- linked_returns: 3
- completed_returns: 3

## 원칙

이 단계는 1회성 데이터 이관입니다. Google Sheet / Apps Script는 조회 fallback 또는 저장 경로로 연결하지 않습니다.
