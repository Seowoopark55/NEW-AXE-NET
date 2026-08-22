# NEW AXE NET v0.8

멤버 관리 모듈에 안전한 신규 멤버 등록 기능을 추가한 버전입니다.

## v0.8 기능
- 관리자에게만 `+ 멤버 추가` 버튼 표시
- 신규 멤버 입력:
  - 닉네임
  - Discord 사용자 ID
  - Discord 표시명
  - 권한
  - 상태
  - 가입일
  - 배지
  - 초기 포인트
- member_key 자동 생성
- 전체 정렬 순서 마지막에 자동 배치
- 등록 후 새 멤버 상세 패널 자동 열기
- 등록 행위도 기존 member_audit_log에 기록
- 일반 authenticated 사용자에게 members INSERT 권한을 직접 열지 않음
- `create_member()` RPC 내부에서 `is_admin()`을 다시 검사

## 적용 순서
1. Supabase SQL Editor에서 `supabase/006_member_create.sql` 전체 실행
2. ZIP 내용을 기존 NEW-AXE-NET 폴더에 덮어쓰기
3. GitHub Desktop → Commit → Push
4. Vercel 자동 배포
5. 관리자 로그인 → `+ 멤버 추가` 테스트

## 관리자 role과 로그인 권한
members.role이 `admin`이어도 NEW AXE NET 로그인 관리자 권한이 자동 생기지는 않습니다.
로그인 관리 권한은 `new_axe_net.admin_accounts`로 별도 관리합니다.
