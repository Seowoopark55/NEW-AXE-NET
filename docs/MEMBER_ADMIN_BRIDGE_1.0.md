# MEMBER ADMIN BRIDGE 1.0

## 목표
최고관리자만 Supabase Auth 이메일 인증을 사용하고, 운영진은 기존 AXE NET 닉네임/비밀번호 로그인만으로 관리 권한을 사용한다.

## 권한 부여
최고관리자가 멤버 관리에서 `role=admin`으로 지정한다. 대상 멤버는 로그아웃 후 다시 로그인하면 된다.

## 내부 동작
1. `/api/member-login`이 AXE NET 자격증명을 검증한다.
2. role=admin이고 별도 수동 Auth 연결이 없는 멤버는 서버가 내부 전용 Supabase Auth 사용자를 생성한다.
3. `admin_accounts`에 해당 Auth 사용자와 member_key를 연결한다.
4. 서버는 멤버 비밀번호와 서버 비밀키로 충분히 긴 내부 Auth 비밀값을 만들고, 해당 로그인 순간에만 브라우저로 전달해 자동 로그인한다. 4자리 멤버 비밀번호도 Supabase Auth 최소 길이 정책에 걸리지 않는다. 내부 이메일/비밀값은 UI에 표시하지 않는다.
5. 기존 관리자 RLS/RPC는 `is_admin()`을 그대로 사용하되, role=admin + active를 추가 확인한다.

## 최고관리자 보호
이미 사람이 직접 만든 `admin_accounts` 연결이 있는 경우 내부 계정을 만들거나 기존 Auth 비밀번호를 변경하지 않는다. 최고관리자는 기존 이메일 인증을 유지한다.

## 권한 회수
멤버 role을 `user`로 변경하면 `is_admin()`이 즉시 false가 되므로 DB 쓰기 권한이 차단된다. UI 반영은 대상 사용자가 로그아웃 후 재로그인하면 가장 확실하다.

## 권한 경계
- superadmin: 멤버 생성/수정/권한 부여 포함 전체 관리자 기능
- operator: 공금 등 운영 관리자 기능 사용, 멤버 권한 부여/수정 불가
