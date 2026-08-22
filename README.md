# NEW AXE NET v0.6

관리자 멤버 수정 기능을 추가한 버전입니다.

## v0.6 기능
- 관리자 로그인 상태에서 멤버 상세 패널에 `멤버 정보 수정` 버튼 표시
- 수정 가능:
  - 닉네임
  - 권한
  - 상태
  - 배지
  - 포인트
  - 퇴사일
- 저장 후 Supabase 즉시 반영
- 저장 후 목록 자동 재조회
- 상태가 `퇴사`인데 퇴사일이 없으면 오늘 날짜 자동 입력
- 상태가 `활동/비활성`이면 퇴사일 자동 제거
- 상세 패널 배경 오버레이를 이전보다 약하게 조정
- X 버튼/바깥 클릭 닫기 모두 유지

## 보안
DB에서도 authenticated 역할의 UPDATE 컬럼을 제한합니다.

수정 허용 컬럼:
- nickname
- role
- status
- badge
- points
- resigned_at

member_key, Discord ID, 정렬순서, 가입일, memo 등은
브라우저 콘솔에서 직접 요청해도 UPDATE 권한이 없습니다.

## 적용 순서
1. Supabase SQL Editor에서 `supabase/004_member_edit.sql` 전체 실행
2. ZIP 내용을 기존 NEW-AXE-NET 폴더에 덮어쓰기
3. GitHub Desktop → Commit → Push
4. Vercel 자동 배포 확인
5. 관리자 로그인 → 멤버 선택 → 멤버 정보 수정 테스트
