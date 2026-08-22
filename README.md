# NEW AXE NET v1.12.0

기존 AXE NET 공금 운영 흐름을 NEW 구조로 묶어서 이관한 패리티 버전입니다.

## 이번 묶음
- 공금납부: 증빙 이미지 필수, 파일첨부, Ctrl+V 붙여넣기, 드래그앤드롭
- 증빙 3MB 제한 + 큰 이미지 자동 최적화
- 공용계좌 / 회사잔고 / 분할납부
- 관리자 대리제출
- 내 제출: 증빙 미리보기, 분할 상세, 검수 결과
- 검수대기: 카드에서 증빙 바로 확인, 승인/거절
- 승인 시 요청의 분할 금액과 증빙이 원장에 그대로 연결
- 증빙은 public URL이 아닌 Supabase private Storage `fund-evidence` 사용

## 적용
1. Supabase SQL Editor에서 `supabase/017_fund_submit_parity.sql` 전체 실행
2. v1.12.0 ZIP을 기존 프로젝트에 덮어쓰기
3. GitHub Desktop Commit / Push
4. Vercel 자동배포

## 환경변수
v1.11에서 추가한 `SUPABASE_SERVICE_ROLE_KEY` 그대로 사용합니다. 새 환경변수는 없습니다.

## CSV
추가 Import 없음.
