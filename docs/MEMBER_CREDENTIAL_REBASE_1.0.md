# NEW AXE NET · MEMBER CREDENTIAL REBASE 1.0

## 목적

NEW AXE NET 일반 멤버 로그인에서 기존 Apps Script 의존을 제거하기 위한 단계적 자격증명 이관입니다.

## 동작

1. `/api/member-login`은 먼저 `new_axe_net.get_member_login_target()`으로 active 멤버와 자격증명 존재 여부를 확인합니다.
2. 자격증명이 이미 있으면 `verify_member_credentials()`로 Supabase에서 직접 검증합니다.
3. 자격증명이 없을 때만 기존 AXE NET 로그인 서버를 1회 호출합니다.
4. 기존 로그인 성공 후 `set_member_password()`가 pgcrypto bcrypt 해시를 저장합니다.
5. 이후 같은 계정은 기존 로그인 서버를 호출하지 않습니다.

## 보안 원칙

- `member_credentials`는 RLS 활성화 + anon/authenticated 권한 없음
- service_role에서만 직접 접근/RPC 실행
- 브라우저에 service role 키나 password hash를 노출하지 않음
- 비밀번호 평문은 DB에 저장하지 않음
- 이미 이관된 계정의 로그인 실패는 레거시 fallback하지 않음

## 완료 조건

SQL 하단의 진행상태 쿼리에서 `remaining_credentials = 0` 확인.
이후 레거시 브리지 코드를 제거하는 후속 릴리스를 적용합니다.
