# NEW AXE NET v0.5

관리자 인증 기반을 추가한 버전입니다.

## v0.5 변경사항
- Supabase Auth 이메일/비밀번호 로그인
- 로그인 상태를 단일 `state.auth`에서 관리
- 세션 유지 및 새로고침 복원
- `new_axe_net.admin_accounts` 관리자 allow-list
- DB 함수 `new_axe_net.is_admin()`으로 관리자 여부 판정
- 멤버 base table의 SELECT/UPDATE RLS를 관리자에게만 허용
- 로그인하지 않은 사용자는 기존 `members_app` 조회 화면을 그대로 사용
- 아직 멤버 수정 UI는 넣지 않음

## 1. SQL 실행

Supabase SQL Editor에서:

`supabase/003_admin_auth.sql`

전체를 실행합니다.

## 2. 관리자 Auth 계정 만들기

Supabase Dashboard:

Authentication → Users → Add user

에서 관리자가 사용할 이메일/비밀번호 계정을 하나 만듭니다.

이메일 확인을 요구하지 않게 만들려면 Dashboard에서 생성할 때
해당 사용자를 confirmed 상태로 생성하세요.

## 3. Auth 사용자와 NEW AXE NET 멤버 연결

Authentication → Users에서 방금 만든 사용자의 UUID를 복사합니다.

그리고 SQL Editor에서 아래 SQL을 실행합니다.

```sql
insert into new_axe_net.admin_accounts (user_id, member_key)
values (
  '여기에_AUTH_USER_UUID',
  (
    select member_key
    from new_axe_net.members
    where nickname = '여기에_관리자_닉네임'
    limit 1
  )
);
```

예를 들어 nickname이 `영포티`라면 마지막 조건만:

```sql
where nickname = '영포티'
```

로 바꾸면 됩니다.

## 4. 코드 배포

기존 NEW-AXE-NET 폴더에 ZIP 내용을 덮어쓴 뒤:

GitHub Desktop → Commit → Push

Vercel이 자동 배포합니다.

## 5. 확인

사이트 우측 상단에 `관리자 로그인` 버튼이 생깁니다.

정상 관리자 계정으로 로그인하면:
- `관리자`
- 연결된 멤버 닉네임
- `로그아웃`

이 표시됩니다.

Auth 로그인에는 성공했지만 `admin_accounts`에 등록되지 않은 사용자는
`권한 없음`으로 표시됩니다.

## 보안 원칙

- `service_role` / secret key를 브라우저 코드에 넣지 않습니다.
- Vercel에는 publishable key만 사용합니다.
- 관리자 판정은 브라우저 문자열이 아니라 DB의 `admin_accounts` + RLS로 처리합니다.
- 기존 password / admin_token 값은 재사용하지 않습니다.
