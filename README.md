# NEW AXE NET v1.35.0

AXE TUBE의 남아 있던 기능 공백인 **댓글**을 Supabase-first로 추가하는 단계입니다.

## 변경사항
- AXE TUBE 영상별 댓글 목록
- 멤버 로그인 댓글 작성
- 본인 댓글 수정 / 삭제
- 수정 댓글 `수정됨` 표시
- 관리자 댓글 삭제(숨김) 권한
- `tube_videos.comment_count` 자동 집계
- 영상 카드 / 상세 화면 댓글 수 표시
- 기존 Discord / AXE BOT / Apps Script / Sheet 동작에는 영향 없음

## 데이터 원칙
기존에 제공된 `AXE_TUBE.csv`에는 댓글 원본 데이터가 없었기 때문에 과거 댓글은 임의로 생성하지 않습니다.
새 댓글은 NEW AXE NET Supabase가 원본입니다.

## 적용 순서
1. `supabase/039_tube_comments.sql` 실행
2. NEW AXE NET v1.35.0 배포
3. 멤버 로그인 후 영상 상세에서 댓글 등록 → 수정 → 삭제 확인
4. 관리자 로그인으로 다른 멤버 댓글 삭제 확인

## 환경변수 / BOT
- 환경변수 변경 없음
- AXE BOT 변경 없음
