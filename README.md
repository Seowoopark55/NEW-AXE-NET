# NEW AXE NET

NEW AXE NET 신규 모듈형 프로젝트의 초기 구조입니다.

## 원칙

- Supabase = 운영 데이터 원본
- Excel = 백업/미러
- 기능별 모듈 분리
- 단일 state
- 단일 API 접근 계층
- UI에서 Supabase 직접 호출 금지
- 기존 AXE NET 레거시 코드 복붙/override 금지

## 최초 실행

1. 프로젝트 폴더에서 터미널 실행
2. `npm install`
3. `.env.example`을 복사해서 `.env` 생성
4. Supabase URL / anon key 입력
5. `npm run dev`

## 구조

```text
src/
├─ api/          Supabase 및 데이터 접근 계층
├─ components/   공용 UI
├─ modules/      기능별 모듈
├─ state/        단일 전역 state
├─ styles/       공용 스타일
├─ utils/        공용 유틸
└─ app.js        앱 시작점
```

현재는 구조 검증용 초기 버전이며, 다음 단계에서 첫 실제 기능으로 멤버 조회를 연결하는 것을 권장합니다.
