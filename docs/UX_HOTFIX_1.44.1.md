# AXE NET 1.44.1 Hotfix

## Fixed
- 무법지대 `searchFocus is not defined` 런타임 오류 제거.
- 위 오류 때문에 이벤트 바인딩이 중단되던 `기록`, 공략 선택/관리, 브리핑맵 선택/관리 동작 복구.
- 같은 IME 패치 구조를 사용하던 자산·계좌 화면의 잠재적 `searchFocus` 오류도 함께 수정.
- 공금내역 상세/수정 모달이 콘텐츠 영역 기준으로 아래/오른쪽에 고정되던 문제를 수정.
  - 화면(viewport) 기준 중앙, 데스크톱 눈높이에 가까운 48dvh 위치.
  - 모달 최대 높이도 동적 viewport 기준으로 제한.
- 페이지 진입 애니메이션에서 `transform`을 제거해 모든 `position: fixed` 모달의 좌표계를 안정화.

## Regression guard
- `npm run audit:ux`가 assets/outlaw의 IME focus restore 스코프를 검사해 같은 오류 재발을 차단.

## Note
콘솔의 `prison_a1.png`, `prison_a2.png`, `prison_b1.png`, `prison_b2.png` 404는 이번 JS 오류와 별개입니다.
원본 AXE NET ZIP에도 해당 단계 이미지 파일이 없으며 기존 UI는 IMAGE NOT MIGRATED fallback을 표시하도록 되어 있습니다.
실제 이미지를 확보하면 `public/assets/outlaw/`에 같은 파일명으로 추가하면 됩니다.
