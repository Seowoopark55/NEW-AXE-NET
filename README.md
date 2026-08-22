# NEW AXE NET v0.2

Supabase custom schema 기반의 NEW AXE NET 초기 연결 버전입니다.

## 핵심 원칙
- 운영 데이터 원본: Supabase
- NEW AXE NET 전용 schema: `new_axe_net`
- Excel: 백업/미러
- 단일 state
- 단일 API 계층
- 기능별 module 분리
- UI에서 Supabase 직접 호출 금지
- 기존 AXE NET 레거시 코드/override 방식 금지

## 적용
기존 프로젝트 폴더에 이 ZIP 내용을 덮어씁니다.
기존 `.env` 파일은 삭제하지 마세요.

`.env` 형식:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
```

기존 `.env`가 `VITE_SUPABASE_ANON_KEY=`로 되어 있다면
키 값은 그대로 두고 변수 이름만 `VITE_SUPABASE_PUBLISHABLE_KEY=`로 바꾸세요.

## DB 초기화
Supabase SQL Editor에서 `supabase/001_init.sql` 전체를 한 번 실행합니다.

## 실행
```powershell
npm.cmd install
npm.cmd run dev
```
