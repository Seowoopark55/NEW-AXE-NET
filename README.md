# NEW AXE NET v1.1

공금 LIVE ENGINE의 첫 운영 쓰기 기능입니다.

## 추가 기능
관리자 로그인 시 공금 화면 상단에 `공금 관리` 버튼이 표시됩니다.

### 면제 관리
- 현재 선택한 주차에 멤버 면제 등록
- 면제 사유 기록
- 활성 면제 목록 확인
- 면제 해제
- 해제 시 행 삭제가 아니라 enabled=false로 과거 기록 보존
- 변경 즉시 LIVE ENGINE 재계산

### 회비 규칙
- 적용 시작 연/월/주차 지정
- 새 주간 공금 금액 추가
- 기존 규칙을 덮어쓰지 않고 이력 누적
- 규칙 활성/비활성 전환
- base_weekly_fee fallback 규칙은 비활성화 불가
- 변경 즉시 LIVE ENGINE 재계산

### 보안
- fund_* 테이블의 INSERT/UPDATE 권한을 브라우저에 직접 열지 않음
- 모든 쓰기는 SECURITY DEFINER RPC
- 각 RPC 내부에서 new_axe_net.is_admin() 재검사
- 공금 설정 변경은 fund_admin_audit_log에 기록

## 적용
1. Supabase SQL Editor에서 `supabase/009_fund_admin.sql` 전체 실행
2. ZIP을 기존 NEW-AXE-NET 폴더에 덮어쓰기
3. GitHub Desktop → Commit → Push
4. Vercel 자동 배포
5. 관리자 로그인 → 공금 → 공금 관리 확인

## 추가 CSV Import
없습니다.
