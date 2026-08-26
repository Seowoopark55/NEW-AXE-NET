# MODBOOK PRESET COMMUNITY 1.0

추천세팅을 단일 고정 프리셋이 아니라 멤버 게시글로 관리합니다.

- 게시글: `new_axe_net.info_preset_posts`
- 슬롯: `new_axe_net.info_preset_post_slots`
- 즐겨찾기: `new_axe_net.member_preset_favorites`
- 원본 개조서: `new_axe_net.info_modbooks`

웹 공개 조회는 active 게시글/슬롯만 RLS로 허용하고, 작성/수정/삭제/즐겨찾기는 AXE 멤버 세션 API를 통해 처리합니다.

작성자는 겉옷/상의/하의/신발마다 접두/접미를 선택하며, 개조서의 옵션 문자열은 복제 저장하지 않습니다. 화면 표시 시 항상 현재 `info_modbooks_app` 데이터를 참조합니다.
