# AXE TUBE Comments 1.0 · v1.35.0

AXE TUBE의 남아 있던 기능 공백인 댓글을 AXE NET Supabase 기준으로 추가합니다.

## 포함
- 활성 영상 댓글 공개 조회
- 멤버 로그인 댓글 작성
- 본인 댓글 수정 / 삭제
- 수정된 댓글에 `수정됨` 표시
- 관리자 전체 댓글 삭제(숨김) 권한
- 영상별 `comment_count` 자동 집계
- 카드/상세 화면 댓글 수 표시

## 보존 원칙
- 댓글은 Google Sheet / 기존 Apps Script에 새로 이중 저장하지 않습니다.
- AXE TUBE의 기준 원본이 이미 Supabase-first로 전환되었으므로 신규 댓글도 Supabase가 원본입니다.
- 기존에 제공된 `AXE_TUBE.csv`에는 댓글 레코드가 없었으므로 과거 댓글을 임의 생성하지 않습니다.

## 적용
1. `supabase/039_tube_comments.sql`
2. v1.35.0 배포
3. 멤버 로그인 → 영상 상세 → 댓글 등록/수정/삭제 확인
4. 관리자 로그인 → 다른 멤버 댓글 삭제 확인

AXE BOT 변경은 없습니다.
