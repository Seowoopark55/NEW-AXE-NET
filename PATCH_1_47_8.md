# AXE NET 1.47.8 · Cooking Order Customization R2

- 운영 > 요리 설정 메뉴 추가
- 관리자 전용 요리 주문 메뉴 추가/수정/ON/OFF
- 메뉴명, 짧은 이름, 설명, SET 가격, 표시 순서 커스텀
- Discord 주문 안내 일정/추가 안내문 커스텀
- 기존 1 / 2M / 2G / 3 주문키 및 기존 주문 기록 호환
- 메뉴 삭제 대신 숨김(OFF)으로 기록 연결 보존
- DB migration: `supabase/054_cooking_order_customization.sql`
- AXE BOT은 해당 DB 메뉴를 신규 주문 선택지에 동적으로 반영
