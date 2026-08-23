# OUTLAW ADMIN MANAGEMENT 1.0

## 범위
- 공략 지역: 추가 / 수정 / 비활성화
- 공략 단계: 추가 / 수정 / 비활성화
- 브리핑맵: 추가 / 수정 / 비활성화
- 통계: BOT 미러링을 단일 입력 경로로 유지하고 웹 수동 편집은 제공하지 않음

## 보안
- 관리자 브라우저는 Supabase Auth 세션을 사용
- 쓰기는 `save_outlaw_*`, `deactivate_outlaw_*` RPC만 사용
- 각 RPC 내부에서 `new_axe_net.is_admin()` 재검증
- anon 실행 권한 없음

## 이미지
현재 무법지대 이미지는 정적 자산 `public/assets/outlaw/`를 사용한다. 관리자 화면의 이미지 필드는 파일명만 관리하며 웹 업로드 기능은 이번 버전에 포함하지 않는다.
