# AXE NET 1.44.0 · Professional UX Release

## 핵심 수정

- 한글 검색 IME 안정화: 검색 중 DOM 재렌더가 자모 조합을 끊지 않도록 composition-aware debounce 적용
- AXE TUBE 재생 유지: 추천/비추천, 댓글 로딩·작성·수정·삭제처럼 상세 정보만 바뀌는 액션은 플레이어 iframe을 다시 만들지 않음
- 바로가기 승격: 상단 QUICK ACCESS 버튼과 홈 바로가기 영역을 운영 런처 형태로 재설계
- 전체 제품 UI polish: 포커스, 카드, 내비게이션, 검색창, 모달, 스크롤바와 hover 계층을 일관화

## 검색 안정화 범위

- 정보
- 멤버
- 자산·계좌
- 무법지대
- AXE TUBE

입력값 반영은 220ms debounce이며 IME composition 중에는 상태 업데이트를 하지 않습니다.

## AXE TUBE 재생 유지

같은 영상 상세 모달이 열린 상태에서 영상 ID가 바뀌지 않는 한 상세 body만 patch합니다. YouTube iframe은 DOM에 그대로 남기 때문에 추천, 댓글 등으로 재생 위치가 초기화되지 않습니다.

## 배포 전 확인

```bash
npm install
npm run build
npm run audit:styles
```

실사용 체크:

1. 정보 검색창에서 `영포티`를 빠르게 한글로 입력
2. AXE TUBE 영상 재생 중 추천 클릭
3. 영상 재생 중 댓글 등록/수정/삭제
4. 상단 바로가기와 홈 바로가기 접근성 확인
5. 모바일 폭에서 바로가기와 내비게이션 확인
