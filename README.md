# NEW AXE NET v0.5.1

v0.5 관리자 인증 버전의 멤버 상세 패널 닫기 버그 수정본입니다.

## 수정사항
- 우측 상세 패널의 `X` 버튼이 닫히지 않던 문제 수정
- 패널 바깥 영역 클릭 닫기 동작은 그대로 유지

## 원인
상세 패널의 바깥 배경과 X 버튼이 같은 `data-close-member-detail` 속성을 사용하고 있었는데,
이벤트 연결 코드가 `querySelector()`로 첫 번째 요소에만 리스너를 붙이고 있었습니다.

`querySelectorAll()`로 변경해 두 요소 모두 닫기 이벤트를 받도록 수정했습니다.

## 적용
1. ZIP 내용을 기존 `NEW-AXE-NET` 폴더에 덮어쓰기
2. GitHub Desktop에서 Commit
3. Push
4. Vercel 자동 배포 확인

이번 버전은 DB 변경이 없으므로 Supabase SQL 실행은 필요 없습니다.
