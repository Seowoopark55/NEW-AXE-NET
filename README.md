# NEW AXE NET v1.38.0

공금 **FINAL CUTOVER — CURRENT AXE NET → NEW AXE NET** 단계입니다.

## 이번 버전의 목적
현재 실제 운영 중인 AXE NET의 공금 `fund_refresh` 상태를 **한 번만 최종 기준점**으로 사용해 NEW AXE NET 공금 데이터를 교체합니다. 전환이 끝나면 Legacy Live Bridge/계속 동기화는 운영 경로에서 사용하지 않습니다.

전환 후 구조:

`Discord/NEW AXE NET → new_axe_net Supabase → Realtime → Discord 상시 현황판`

기존 AXE NET은 최종 전환 시점의 이관 원본일 뿐, 전환 이후 공금 원본이 아닙니다.

## DB 변경
Supabase SQL Editor에서 `supabase/041_fund_final_cutover.sql` 전체를 **1회 실행**합니다.

041은 다음을 추가합니다.
- `fund_cutover_archives`: 전환 직전 NEW 공금 전체 백업 + CURRENT AXE 원본 스냅샷 보관
- `fund_runtime_config`: 공금 원본이 NEW로 전환됐는지 영구 기록
- `apply_current_axe_fund_snapshot(jsonb)`: CURRENT AXE 스냅샷을 한 트랜잭션으로 적용
- `bot_submit_fund_request(...)`: Discord 공금 제출 NEW Supabase 직결
- `bot_review_fund_request(...)`: Discord 승인/반려 NEW Supabase 직결

`apply_current_axe_fund_snapshot`은 적용 전·후 공용계좌 잔액이 CURRENT AXE 기준값과 1원이라도 다르면 예외를 발생시켜 **트랜잭션 전체를 롤백**합니다.

## 최종 전환
SQL 실행 후 AXE BOT V11을 배포하고 Discord 관리자 계정으로 아래 명령을 **딱 한 번** 실행합니다.

`!공금최종전환`

BOT은 CURRENT AXE NET의 `fund_refresh` payload에서 공금멤버/신청/원장/면제/요율을 한 번에 읽습니다. Legacy Supabase의 공금 테이블을 별도로 섞지 않습니다.

성공 시:
- CURRENT AXE 기준 공용계좌 잔액 = NEW 적용 잔액
- 이전 NEW 공금 상태 자동 백업
- DB `primary_source = new_axe_net` 저장
- 제출/검수 NEW Supabase 직결
- Discord 상시 현황판 NEW Realtime 자동 갱신

## Discord 현황판
현황판은 데스크톱에서 Discord inline field를 이용해:
- 좌측: `📋 주차별 납부 현황`
- 우측: `📌 미납자 명단` (주차별 인원수 + 이름)
- 하단: 이번 주 면제·가입 전 / 범례

형태로 표시됩니다. 좁은 화면에서는 Discord가 자동으로 세로 배치합니다.

## 운영 명령
최종 전환 후:
- `!공금업데이트`: NEW 상태/검수카드/현황판 강제 새로고침
- `!공금현황판설정`: 상시 현황판 채널 설정
- `!공금현황판해제`: 상시 현황판 해제

기존 `!공금최종동기화`, `!공금충돌`, `!공금잔액감사`는 종료 안내만 반환합니다.

## 환경변수
새 환경변수는 없습니다. 기존 BOT의 `NEW_AXE_NET_SUPABASE_URL`, `NEW_AXE_NET_SUPABASE_SECRET_KEY`를 그대로 사용합니다.

`AXE_FUND_REFERENCE_SOURCE`를 수동으로 바꿀 필요가 없습니다. 최종 전환 성공 여부는 `fund_runtime_config`와 BOT 상태에 저장되고, BOT 재시작 시 DB 설정을 다시 읽습니다.

## 주의
최종 전환 명령을 실행하는 짧은 시간 동안 CURRENT AXE NET에서 공금 등록/승인/수정을 잠시 멈춰주세요. 성공 메시지가 나온 시점부터 기존 AXE NET 공금 화면은 더 이상 운영 원본으로 사용하지 않습니다.
