# NEW AXE NET v1.31.0

AXE TUBE 병행운영 2단계입니다.

## 추가
- 멤버 로그인 기반 추천 / 비추천
- 같은 반응 재클릭 시 취소, 다른 반응 클릭 시 변경
- 기존 AXE TUBE 카운터와 NEW AXE NET 카운터를 합산 보존하는 legacy metrics bridge
- BOT Shadow Mirror V2와 함께 사용 시 기존 AXE TUBE의 조회/추천/비추천 변화량 반영
- 기존 AXE TUBE에서 삭제된 legacy 영상은 전체 동기화 시 NEW AXE NET에서 비활성화

## 유지
- 영상 신규 등록 / 수정은 아직 기존 AXE TUBE / Discord 흐름을 유지
- NEW AXE NET 런타임에 Apps Script fallback을 추가하지 않음

## 적용
1. Supabase SQL Editor에서 `supabase/035_tube_reactions_bridge.sql` 실행
2. 이 버전을 GitHub에 반영 후 Vercel 배포
3. AXE BOT `AXE_BOT_TUBE_MIRROR_V2/index.js` 배포
4. Discord에서 `!튜브동기화` 실행 후 로그 확인
