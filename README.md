# NEW AXE NET v1.11.0 — Account Bridge + AXE Shell Parity

기존 AXE NET을 기능/UX 명세로 삼아 NEW AXE NET에 **이식**하기 시작한 첫 패리티 번들입니다.
이번 버전부터 작은 기능을 하나씩 새로 설계하는 방식이 아니라 기존 AXE NET의 운영 흐름을 화면 단위로 가져옵니다.

## 이번 버전 핵심

### 1. 상단 구조를 기존 AXE NET 방향으로 재설계
- 로그인/시스템 상태를 배너 밖의 상단 유틸리티 바로 분리
- 메인 AXE 배너를 184px 기준으로 확대
- 로고 128px, `AXE COMPANY NETWORK / NEW AXE NET / AXE 내부 운영 시스템` 위계 적용
- AXE 워터마크/NETWORK 장식과 절제된 골드 광택 적용

### 2. 일반 멤버 로그인 추가
- 기존 AXE NET 닉네임 + 비밀번호를 그대로 사용
- 기존 AXE NET Apps Script에서 비밀번호를 검증한 뒤 NEW AXE NET 서버 세션 생성
- 브라우저 JavaScript가 읽을 수 없는 HttpOnly 세션 쿠키 사용
- DB에는 세션 토큰 원문이 아니라 SHA-256 해시만 저장
- 비밀번호는 NEW AXE NET DB에 저장하지 않음

### 3. 공금납부 Discord 숫자 ID 입력 제거
- 로그인한 멤버를 자동 제출자로 사용
- Discord 사용자 ID는 Vercel 서버가 `new_axe_net.members`에서 내부 확인
- 일반 사용자는 Discord 개발자 모드/숫자 ID를 알 필요가 없음
- 기존 Supabase Auth 관리자는 `admin_session.member_key`로 자동 본인확인

### 4. 공금납부를 기존 AXE NET 흐름에 더 가깝게 변경
- 내 미납 주차 자동 조회
- 납부 방식: 공용계좌 / 회사잔고
- 총 납부금액 입력
- 증빙 링크
- 메모
- 제출 → 검수대기 → 관리자 승인 시 원장 반영
- 내 제출 역시 로그인 계정 기준 자동 조회

> 증빙 스크린샷 직접 붙여넣기/파일 업로드와 분할납부는 다음 패리티 번들에서 기존 AXE NET 방식으로 이식합니다.

---

## 적용 순서

### 1) Supabase SQL 1회 실행
Supabase → SQL Editor에서 아래 파일 전체를 실행합니다.

`supabase/016_member_web_sessions.sql`

기존 데이터 삭제/초기화는 하지 않습니다.

### 2) Vercel 환경변수 1개 추가
Vercel → Project → Settings → Environment Variables

```text
SUPABASE_SERVICE_ROLE_KEY=Supabase의 service_role secret key
```

중요:
- `VITE_` 접두사를 붙이지 않습니다.
- GitHub에 커밋하지 않습니다.
- 브라우저 코드에 넣지 않습니다.

기존 환경변수는 그대로 유지합니다.

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

기존 AXE NET Apps Script 주소가 변경된 경우에만 선택적으로 추가합니다.

```text
AXE_LEGACY_API_URL=https://script.google.com/macros/s/.../exec
```

미지정하면 v1.11.0에 현재 안정본 주소가 기본값으로 들어 있습니다.

### 3) 파일 덮어쓰기 → Commit → Push
ZIP 내용을 현재 NEW-AXE-NET 저장소에 덮어씁니다.

### 4) Vercel 재배포 확인
환경변수를 새로 추가한 뒤에는 새 Deployment가 생성되어야 합니다.

---

## 확인 순서

1. 상단에서 `SYSTEM ONLINE`이 표시되는지 확인
2. 로그인/관리자 표시가 큰 배너 밖 위쪽에 표시되는지 확인
3. 배너가 기존보다 크게 표시되는지 확인
4. 로그아웃 상태에서 `공금 → 공금납부` 선택
5. `로그인` 클릭 → 기존 AXE NET 닉네임/비밀번호 입력
6. 로그인 후 Discord 숫자 ID 입력창 없이 내 공금현황이 자동 표시되는지 확인
7. 미납 주차 선택 → 공용계좌/회사잔고 선택 → 제출
8. `내 제출`에서 방금 제출 건이 보이는지 확인
9. 관리자 로그인 상태에서는 별도의 멤버 로그인 없이 관리자 연결 멤버의 공금정보가 자동 표시되는지 확인

## 구조

- `/api/member-login.js` — 기존 AXE NET 로그인 검증 → NEW 웹 세션 발급
- `/api/member-session.js` — 세션 확인 / 로그아웃 / 내 공금 조회 / 공금 제출
- `/server/memberSession.js` — service role 전용 서버 로직
- `/src/modules/auth/memberAuthService.js` — 브라우저 멤버 세션 클라이언트
- `/supabase/016_member_web_sessions.sql` — 서버 전용 웹 세션 원장
- `/docs/AXE_NET_PARITY_PLAN.md` — 이후 이식 기준

## 보안 기준

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다.
- 일반 멤버는 `member_web_sessions` 테이블을 직접 읽을 수 없습니다.
- 멤버 세션 원문은 localStorage가 아니라 HttpOnly + SameSite 쿠키로 전달합니다.
- 사용자 비밀번호는 NEW AXE NET DB에 저장하지 않습니다.
- Discord 숫자 ID는 공금 본인확인에 내부적으로 쓰지만 UI에는 노출하지 않습니다.
