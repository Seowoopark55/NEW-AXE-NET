# NEW AXE NET v0.3

NEW AXE NET의 첫 실제 데이터 모듈인 `members` 연결 버전입니다.

## 구조
- GitHub: NEW-AXE-NET 전용 저장소
- Vercel: GitHub push 자동 배포
- Supabase: AXE WAR 프로젝트 공유
- NEW AXE NET DB schema: `new_axe_net`

## v0.3 적용 순서

1. 이 ZIP 내용을 기존 `NEW-AXE-NET` 로컬 폴더에 덮어씁니다.
2. Supabase SQL Editor에서 `supabase/002_members.sql` 전체를 실행합니다.
3. Supabase Table Editor에서 `new_axe_net.members`를 선택합니다.
4. `supabase/data/members_import.csv`를 Import 합니다.
5. GitHub Desktop에서 Commit → Push 합니다.
6. Vercel 자동 배포 후 NEW AXE NET 멤버 화면을 확인합니다.

## 데이터 병합 기준
- `member_key`를 기준으로 기존 Supabase `public.members`와 기존 회원 CSV를 병합했습니다.
- nickname / role / enabled↔status가 25명 모두 일치하는 것을 확인했습니다.
- `enabled`는 NEW 구조에서 제거하고 `status` 하나를 기준 상태값으로 사용합니다.
- password / admin_token / admin_token_until은 NEW members 테이블로 이전하지 않습니다.
- Discord numeric ID와 memo는 base table에 보관하되 브라우저용 `members_app` view에서는 노출하지 않습니다.

## 환경변수
`.env`는 기존 파일을 유지합니다.

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
```
