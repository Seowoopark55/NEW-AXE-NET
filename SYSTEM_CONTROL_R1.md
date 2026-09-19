# AXE NET · SYSTEM CONTROL R1

## 목적
- AXE NET과 AXE BOT의 서비스 ON/OFF 상태를 NEW AXE NET Supabase에 중앙 저장합니다.
- OFF는 서버 종료나 데이터 삭제가 아닙니다.
- 최고관리자(superadmin)만 상태를 변경할 수 있습니다.
- 변경 이력은 `new_axe_net.runtime_control_audit`에 기록됩니다.

## 적용 순서
1. Supabase SQL Editor에서 `supabase/053_system_runtime_control.sql` 실행
2. AXE NET WEB 소스 배포
3. AXE NET `운영 > 시스템 제어`에서 두 상태가 ON으로 표시되는지 확인
4. AXE BOT 패치는 별도 검증 후 적용

## AXE NET OFF 동작
- 일반 사용자는 운영 중지 화면만 봅니다.
- 멤버 로그인/가입 및 일반 member-session API 기능을 차단합니다.
- 최고관리자는 기존 관리자 인증으로 로그인 후 `시스템 제어`에 접근해 다시 ON 할 수 있습니다.
- DB 데이터/설정은 삭제하지 않습니다.

## AXE BOT OFF 동작
- Discord 프로세스/게이트웨이 연결은 유지합니다.
- 메시지 명령과 버튼/모달 처리를 중앙에서 차단합니다.
- 개조서 주기 갱신, 공금 Realtime 갱신/자동 동기화, 총알 자동 갱신은 OFF 동안 실행하지 않습니다.
- 다시 ON 되면 별도 PM2 재시작 없이 상태 polling으로 감지해 기능을 재개합니다.

## 검증
- AXE NET style audit PASS
- AXE NET UX audit PASS
- 변경 JS syntax PASS
- AXE BOT 전체 JS syntax PASS
- AXE BOT runtime control mock ON→OFF PASS
- 현재 작업 환경에는 Vite 실행 파일이 없어 production build는 실행하지 못했습니다.
