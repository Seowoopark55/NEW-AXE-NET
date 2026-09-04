# AXE NET v1.47.6 · 플리카 계좌 별칭 관리자

## 목적
Discord BOT에서만 관리하던 플리카 계좌 별칭을 NEW AXE NET의 `자산 · 계좌 > 플리카 계좌` 관리자 화면에서도 관리할 수 있게 합니다.

## 변경
- 계좌 목록에서 현재 활성 별칭 표시
- 계좌 검색 시 별칭도 검색 대상에 포함
- `관리` 모달에서 별칭 추가/삭제
- 계좌번호/사용상태/메모와 별칭을 같은 화면에서 관리
- BOT의 계좌 조회는 기존 `member_account_aliases`를 그대로 사용하므로 NET에서 변경한 별칭도 즉시 같은 DB 기준으로 사용

## DB
먼저 `supabase/050_member_account_alias_admin.sql`을 SQL Editor에서 적용해야 합니다.
이 SQL은 기존 별칭 데이터를 삭제하지 않으며 관리자 SELECT 정책과 별칭 저장/비활성화 RPC만 추가합니다.

## 권한
- 별칭 목록 브라우저 직접 조회: Supabase Auth 관리자 + `is_admin()`
- 별칭 추가/삭제: 관리자 전용 SECURITY DEFINER RPC
- 일반 멤버에게 별칭 관리 UI는 노출하지 않음
