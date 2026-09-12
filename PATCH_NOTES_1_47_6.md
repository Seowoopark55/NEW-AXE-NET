# NEW AXE NET 1.47.6 · MEMBER SIGNUP HOTFIX R1

## 원인
1.47.5의 신규 Supabase 멤버 인증 전환 이후, 웹에는 로그인 API만 남아 있고 신규 멤버가 `member_credentials`를 최초 생성하는 회원가입 UI/API가 없었습니다.
기존 계정은 legacy first-login migration으로 로그인할 수 있었지만, 신규 입사자는 기존 웹 계정이 없으므로 최초 비밀번호를 만들 수 없었습니다.

## 수정
- 로그인 모달의 멤버 영역에 `로그인 / 첫 가입` 탭 추가
- `/api/member-signup` 신규 추가
- `new_axe_net.members`에 이미 등록된 active 멤버만 첫 가입 허용
- 기존 회원가입 서버를 1회 검증/생성 브리지로 사용해 미이관 기존 닉네임 탈취 방지
- 가입 성공 직후 `set_member_password` RPC로 bcrypt 이관하여 이후 로그인은 Supabase에서 처리
- 가입 완료 즉시 멤버 웹 세션 발급 및 자동 로그인
- 이미 credential이 있는 멤버는 재가입 차단 후 로그인 안내
- role=admin 멤버는 기존 admin bridge를 그대로 연결

## DB
추가 SQL 없음. 현재 운영 중인 `025_member_credentials.sql` 구조를 그대로 사용합니다.

## 운영 전제
신입은 먼저 관리자 멤버 관리에서 `new_axe_net.members`에 active 상태로 등록되어 있어야 합니다.
그 뒤 웹의 `로그인 > 멤버 로그인 > 첫 가입`에서 닉네임/비밀번호를 설정합니다.
