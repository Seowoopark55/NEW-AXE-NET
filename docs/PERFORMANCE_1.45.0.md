# AXE NET 1.45.0 · Startup Performance

목표: 접속 후 홈 화면과 홈 핵심 데이터가 보이는 시간을 줄입니다.

## 변경 사항
- 홈 UI를 인증/원격 데이터보다 먼저 렌더링
- Supabase 연결 상태 확인을 독립 병렬 처리
- 인증 완료 후 독립 모듈 초기 조회를 `Promise.allSettled`로 병렬 처리
- 관리자 세션 프로필 조회와 멤버 세션 검증 병렬화
- 최근 공금 내역은 도착 즉시 홈에 반영
- 무거운 공금 관리자 데이터 7종은 관리자 섹션 진입 시에만 로드
- AXE TUBE 영상 목록은 멤버 추천/비추천 조회를 기다리지 않고 먼저 표시
- 홈 로딩 중 '데이터 없음' 오표시 대신 섹션별 로딩 문구 사용
- 메인 배너 PNG(약 558KB) 대신 동일 크기 WebP(약 46KB) 사용

## 변경하지 않은 것
- Supabase schema / RPC / 환경변수 변경 없음
- 기존 기능/권한/데이터 구조 변경 없음
- AXE NET UI 구조 변경 없음

## 확인
```powershell
npm.cmd run audit:styles
npm.cmd run audit:ux
npm.cmd run build
```

실제 배포 후 새로고침하여 홈, 공금, AXE TUBE, 무법지대, 자산/계좌를 확인합니다.
