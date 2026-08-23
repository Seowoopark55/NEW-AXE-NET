# NEW AXE NET · 자산·계좌 모듈 1.0

버전: v1.28.0

## 목적

기존 AXE NET의 회사자산 / 퇴사자 반납내역 / 플리카 계좌 기능을 NEW AXE NET의 `new_axe_net` schema로 재구축합니다.
운영 중 조회·등록·수정·승인 경로는 Supabase를 기준으로 하며 Google Sheet / Apps Script를 런타임 데이터 소스로 사용하지 않습니다.

## 상위 메뉴

`자산·계좌` 하나의 상위 메뉴 아래에서 역할에 따라 화면을 나눕니다.

### 일반 멤버
- 플리카 계좌 검색
- 계좌번호 클릭/복사
- 본인 플리카 계좌 등록·변경 신청
- 본인 신청 처리상태 확인

### 관리자
- 일반 멤버 기능 전체
- 플리카 계좌 직접 등록/수정/사용중지
- 계좌 신청 승인/반려
- 회사 자산 등록/수정/목록 내리기
- 퇴사자·자산 반납내역 등록/수정/목록 내리기

## 보안 구조

플리카 계좌번호는 anon 공개 데이터로 취급하지 않습니다.

- 일반 멤버: HttpOnly 멤버 세션 → `/api/member-session` → Vercel 서버의 service-role Supabase client
- 관리자: Supabase Auth → RLS `new_axe_net.is_admin()` + 관리자 RPC
- 로그아웃 상태: 계좌번호 조회 불가
- 멤버 신청 시 `member_key`와 `nickname`은 브라우저 입력값을 신뢰하지 않고 서버의 현재 로그인 세션에서 강제 결정

## DB

`supabase/026_assets_plika.sql`

생성 테이블:
- `new_axe_net.company_assets`
- `new_axe_net.company_asset_returns`
- `new_axe_net.member_accounts`
- `new_axe_net.member_account_requests`

관리자 RPC:
- `save_company_asset`
- `deactivate_company_asset`
- `save_company_asset_return`
- `deactivate_company_asset_return`
- `save_member_account`
- `deactivate_member_account`
- `review_member_account_request`

## 기존 플리카 데이터 1회 이관

`supabase/027_plika_legacy_import_optional.sql`은 **선택 실행**입니다.
기존 AXE NET이 과거 동기화해 둔 `public.member_accounts`가 존재하는 경우에만 해당 테이블을 읽어서 `new_axe_net.member_accounts`로 한 번 복사합니다.

- `public` 데이터 수정 없음
- NEW AXE NET 런타임에서 `public` 조회 없음
- 닉네임 또는 기존 member_key로 NEW 멤버와 매칭되는 행만 이관
- `026_assets_plika.sql` 실행 후 사용

## 회사 자산 기존 데이터

v1.28.0은 회사 자산의 NEW DB 구조와 운영 UI를 먼저 완성합니다.
기존 Google Sheet 회사자산/반납 행은 런타임 fallback으로 연결하지 않습니다.
기존 행을 유지해야 할 경우 별도의 **1회성 import**로 `new_axe_net`에 옮긴 뒤 Sheet 의존 없이 운영합니다.

## Realtime

v1.28.0에서는 자산·계좌에 별도 Realtime channel을 추가하지 않습니다.
저장/승인 후 현재 화면 데이터를 다시 읽어 즉시 반영합니다.
향후 다중 관리자의 동시 편집 필요성이 확인될 때 Realtime을 별도 단계로 추가합니다.
