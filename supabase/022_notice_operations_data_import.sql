-- NEW AXE NET v1.25.x
-- 022_notice_operations_data_import.sql
-- 기존 AXE NET 공지사항 / 운영기준 실데이터 이관
-- 재실행 가능: legacy_id 기준 UPSERT

begin;

-- =========================================================
-- 1) 운영기준
-- =========================================================
insert into new_axe_net.operation_rules
  (legacy_id, category, title, content, sort_order, active, writer)
values (
  'op_001', '운영기준', '회사 공금',
  '📌 회사 공금 운영 기준

공금은 회사 운영을 위한 공동 자산입니다.

아래 기준에 따라 납부 및 관리됩니다.

■ 공금 납부 기준

공금은 **주 1회 2만원**입니다.
 신입은 **입사 후 첫 2주간 공금 납부가 면제**됩니다.
 공금 1회 미납 시 경고, 이후 재발 시 내부 조치가 진행됩니다.

 ■ 공금 납부 방법

공금 → 인게임 회사 (O) → 공용 계좌 입금', 1, true, null
)
on conflict (legacy_id) do update set
  category = excluded.category,
  title = excluded.title,
  content = excluded.content,
  sort_order = excluded.sort_order,
  active = excluded.active,
  writer = excluded.writer;

insert into new_axe_net.operation_rules
  (legacy_id, category, title, content, sort_order, active, writer)
values (
  'op_002', '운영기준', '회사 자산 운영 기준',
  '📌[회사 자산 운영 및 전력 배치 기준 안내]

회사의 장기적인 안정성과 전력 운용의 명확성을 위해
회사 자산의 관리 및 배치 기준을 아래와 같이 명시합니다.

[ 회사 자산의 정의 ] 

무법지대, 보스, 단체 콘텐츠 및 회사 자원이 일부라도 투입되어 획득·제작된 도안 및 무기는 회사 자산으로 분류합니다.

해당 자산은 개인 보상이 아닌, 회사 전력 운용 자산입니다.

퇴사 시 회사 자산은 회사에 다시 반환됩니다.

[ 자산의 구분 ]

회사는 자산을 다음과 같이 구분하여 운영합니다.

[ 일반 자산 ]

수급이 가능한 장비

[ 전략 자산 ]
장기간의 누적 활동과 높은 난이도를 통해 획득된 희귀 도안 및 핵심 장비

전략 자산은 회사 전력 안정성에 직접적인 영향을 미치는 자산으로 별도 관리됩니다.

[ 전력 배치 원칙 ]

회사 자산의 배치는 개인 보상 목적이 아닌 전력 안정성과 운용 효율을 위한 배치 결정입니다.

특히 전략 자산은 다음 요소를 종합적으로 고려하여 배치합니다.

-장기 활동 및 기여 지속성
-회사 콘텐츠 참여 이력
-전력 균형 상태
-자산 운용 안정성 및 이탈 리스크

이는 특정 인원을 우대하기 위함이 아니라,
장기간 축적된 회사 자산의 가치를 보호하고
전력 공백을 최소화하기 위한 운영 기준입니다.

[ 운영 방식 ]

자산 배치는 단일 수치나 일회성 참여 기준으로 결정되지 않으며,
운영 원칙에 따라 임원진 협의 하에 종합 판단하여 결정됩니다.

이는 회사 자산이 개인 소유 개념이 아닌
공동 전력 자산이라는 성격에 따른 운영 방식입니다.

[ 마치며 ]

회사는 단기적 형평이 아닌,
장기적 안정성과 누적 기여 가치를 존중하는 구조로 운영됩니다.', 2, true, null
)
on conflict (legacy_id) do update set
  category = excluded.category,
  title = excluded.title,
  content = excluded.content,
  sort_order = excluded.sort_order,
  active = excluded.active,
  writer = excluded.writer;

insert into new_axe_net.operation_rules
  (legacy_id, category, title, content, sort_order, active, writer)
values (
  'op_003', '운영기준', '공용 물품',
  '📌 공용 물품 관리 기준

공용 물품은 회사 공동 자산이며, 개인 소유가 아닙니다.

사용 및 반납은 아래 기준을 따릅니다.

공용 물품을 소지한 상태로 퇴근할 경우 2,000원의 벌금이 부과됩니다.
- 해당 위반 발생 시, 공용 물품 사용이 3일간 제한됩니다.', 3, true, null
)
on conflict (legacy_id) do update set
  category = excluded.category,
  title = excluded.title,
  content = excluded.content,
  sort_order = excluded.sort_order,
  active = excluded.active,
  writer = excluded.writer;

insert into new_axe_net.operation_rules
  (legacy_id, category, title, content, sort_order, active, writer)
values (
  'op_004', '운영기준', '접속 관련 규정',
  '📌 접속 관련 규정

원활한 회사 운영을 위해 최소 접속 기준을 둡니다.

- 5일 이상 미접속 시 자동 추방됩니다.
개인 사정 등으로 장기간 접속이 어려운 경우,
    
    사전 통보 시 예외 적용이 가능합니다.', 4, true, null
)
on conflict (legacy_id) do update set
  category = excluded.category,
  title = excluded.title,
  content = excluded.content,
  sort_order = excluded.sort_order,
  active = excluded.active,
  writer = excluded.writer;

insert into new_axe_net.operation_rules
  (legacy_id, category, title, content, sort_order, active, writer)
values (
  'op_005', '운영기준', '탈퇴 관련 안내',
  '📌 탈퇴 관련 안내

## AXE 팀 탈퇴 시, 회사 자산 정산 절차를 진행합니다.

- 팀 공동 자산으로 사용된 모든 아이템은 회사에 귀속되며 회수 대상입니다.
- 해당 아이템은 팀 활동을 통해 축적된 회사 자산입니다.
- 탈퇴 전 관련 자산은 원활히 인계해 주시기 바랍니다.', 5, true, null
)
on conflict (legacy_id) do update set
  category = excluded.category,
  title = excluded.title,
  content = excluded.content,
  sort_order = excluded.sort_order,
  active = excluded.active,
  writer = excluded.writer;

insert into new_axe_net.operation_rules
  (legacy_id, category, title, content, sort_order, active, writer)
values (
  'op_006', '운영기준', '음성채팅 TTS 기준',
  '📌디스코드 TTS 사용 관련 운영 기준 안내

현재 우리 회사 디스코드는 음성 대화 중심으로 활발하게 운영되고 있습니다.
이 과정에서 TTS 기능이 과도하게 사용되면서 아래와 같은 문제가 지속적으로 발생하고 있습니다.

음성 대화 중 TTS가 겹쳐 대화 흐름이 끊김
동시에 여러 명이 사용할 경우 발화자 및 내용 식별 어려움
불필요한 소음 증가로 인해 전투 및 협업 집중도 저하
이미지 및 텍스트 남발로 채팅 가독성 저하

기존에 TTS 기능은 마이크 사용이 어려운 팀원을 배려하기 위해 도입된 기능입니다.
하지만 현재는 해당 목적을 벗어나 일반적인 대화 수단처럼 사용되고 있어 운영에 혼선이 발생하고 있습니다.

이에 따라 아래와 같이 기준을 정합니다.

   [ TTS 사용 기준 ]

TTS는 마이크 사용이 불가능한 상황에서만 제한적으로 사용 가능
마이크 사용이 가능한 경우 음성 대화를 원칙으로 진행
TTS를 통한 불필요한 도배, 이미지 첨부, 반복 사용 금지**

[ 운영 방향 ]

우리 팀은 빠르고 정확한 소통이 중요한 구조입니다.
특히 전투나 상황 대응 시에는 즉각적인 음성 전달이 가장 효율적입니다.

TTS는 보조 수단이지, 음성을 대체하는 수단이 아닙니다.
모두가 원활하게 소통할 수 있도록 위 기준을 반드시 지켜주시기 바랍니다.

필요 시 운영진이 개별적으로 안내드릴 수 있습니다.
협조 부탁드립니다.', 6, true, null
)
on conflict (legacy_id) do update set
  category = excluded.category,
  title = excluded.title,
  content = excluded.content,
  sort_order = excluded.sort_order,
  active = excluded.active,
  writer = excluded.writer;

-- =========================================================
-- 2) 공지사항
-- =========================================================
insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_001', '일반공지', 'AXE회사 홈페이지 개설',
  '홈페이지가 개설 됐습니다.', false, null,
  '2026-05-04T00:00:00+09:00'::timestamptz, 'published', '2026-05-04T00:00:00+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_002', '패치노트', '홈페이지 기능 추가',
  '기존 신청 - > 승인 구조에서 이용자가 즉시 등록 하는 구조로 변경됐습니다.
댓글 / 추천 / 게시글 삭제 및 수정 / 댓글삭제 및 수정 기능들이 추가 됐습니다.
댓글 수정시 수정 표시가 됩니다.', false, null,
  '2026-05-05T00:00:00+09:00'::timestamptz, 'published', '2026-05-24T00:00:00+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_003', '패치노트', '모바일 최적화 완료',
  'AXE NET을 보바일로 켰을때도 모바일 환경에 맞게 최적화가 완료 됐습니다.
다만 디스코드 - > 링크로 바로 연결하는 방식보다는 
인터넷 브라우저로 접속하시는걸 더 추천 드립니다.', false, null,
  '2026-05-06T00:00:00+09:00'::timestamptz, 'published', '2026-05-24T00:00:00+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_1778325420744_15e54750', '패치노트', '즐겨찾기 기능 추가',
  '화면 우측 즐겨찾기 기능 추가.

제일 아래 카테고리까지 최대 18개까지 추가 가능 ( 예 : 개조서 )

즐겨찾기 창 접었다 펼치는것도 가능합니다.', false, '영포티',
  '2026-05-09T20:17:01+09:00'::timestamptz, 'published', '2026-05-24T00:00:00+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_1779594737330_66225566', '패치노트', '개조서 등록신청 기능 추가 안내',
  'AXE NET 개조서 기능이 개선되었습니다.

이제 누락된 개조서 정보를 사이트에서 직접 등록신청할 수 있습니다.

■ 주요 내용
- 일반 팀원: 개조서 등록신청 가능
- 관리자: 신청 내역 승인/반려 가능
- 승인된 개조서는 정식 개조서 목록에 반영
- 개조위치, 분류, 부위, 옵션, 성공률 등 신청 가능
- 분류1/분류2, 부위1/부위2 선택 지원
- 옵션분류 선택 후 해당 옵션만 선택 가능하도록 개선

엑셀을 직접 수정하지 않아도 사이트에서 개조서 정보를 신청할 수 있도록 개선되었습니다.', false, '영포티',
  '2026-05-24T12:52:17+09:00'::timestamptz, 'published', '2026-05-24T12:52:17+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_1779594786814_bb65f424', '패치노트', '개조서 옵션 및 분류 선택 방식 개선',
  '개조서 등록신청 시 옵션과 분류 선택 방식이 개선되었습니다.

■ 주요 내용
- 개조서 분류를 시트 기준으로 관리하도록 개선
- 신규 분류 추가 시 사이트에 자동 반영
- 옵션 목록을 옵션분류별로 선택 가능하도록 개선
- 예: 채광 선택 시 채광 관련 옵션만 표시
- 옵션 수치 범위 선택 기능 추가
- 디버프 체크 시 자동으로 음수 옵션으로 반영

개조서 등록신청 과정에서 잘못된 옵션을 선택할 가능성을 줄이고, 더 쉽게 정보를 입력할 수 있도록 개선되었습니다.', false, '영포티',
  '2026-05-24T12:53:07+09:00'::timestamptz, 'published', '2026-05-24T12:53:07+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_1779594870105_68821277', '패치노트', '플리카 계좌 빠른도구 추가 안내',
  '플리카 계좌 확인 기능이 추가되었습니다.

■ 주요 내용
- AXE TODAY 옆에 플리카 계좌 버튼 추가
- 멤버명 검색 기능 지원
- 계좌번호 클릭 또는 복사 버튼으로 즉시 복사 가능
- 계좌 미등록 멤버는 미등록으로 표시
- 사이트 진입 시 기본 접힘 상태로 표시

인게임 입금 시 엑셀을 따로 열지 않고, 사이트에서 계좌를 빠르게 확인하고 복사할 수 있도록 개선되었습니다.', false, '영포티',
  '2026-05-24T12:54:30+09:00'::timestamptz, 'published', '2026-05-24T12:54:30+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_1779594904952_88ee78e7', '패치노트', '플리카 계좌 등록신청 및 관리 기능 추가',
  '플리카 계좌 기능에 등록신청 및 관리자 관리 기능이 추가되었습니다.

■ 주요 내용
- 일반 팀원: 플리카 계좌 등록신청 가능
- 관리자: 신청 내역 승인/반려 가능
- 관리자 계정에서 계좌 추가/수정/삭제 가능
- 같은 멤버명이 있는 경우 기존 계좌정보 업데이트
- 계좌 수정 시 기존 번호가 유지되도록 개선
- 등록신청, 추가, 수정, 삭제 화면을 전용 모달 UI로 개선

계좌정보를 사이트에서 더 편리하게 관리할 수 있도록 개선되었습니다.', false, '영포티',
  '2026-05-24T12:55:05+09:00'::timestamptz, 'published', '2026-05-24T12:55:05+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into new_axe_net.notices
  (legacy_id, notice_type, title, content, important, writer, published_at, status, updated_at)
values (
  'notice_1779594955134_507a4888', '패치노트', 'AXE NET 관리 기능 개선',
  'AXE NET의 주요 관리 기능이 전반적으로 개선되었습니다.

■ 주요 개선 내용
- 공금내역 관리 화면 정리
- 공금내역 메모 보기 방식 개선
- 공금내역 편집/삭제 관리 구조 개선
- 자산관리 필터 UI 정리
- 퇴사자 및 자산 반납 관리 기능 보강
- 개조서 가격설정 권한 확대
- 개조서 등록신청 및 승인/반려 기능 추가
- 플리카 계좌 빠른도구 추가

사이트 내에서 더 많은 운영 업무를 처리할 수 있도록 관리 편의성을 개선했습니다.', false, '영포티',
  '2026-05-24T12:55:55+09:00'::timestamptz, 'published', '2026-05-24T12:55:55+09:00'::timestamptz
)
on conflict (legacy_id) do update set
  notice_type = excluded.notice_type,
  title = excluded.title,
  content = excluded.content,
  important = excluded.important,
  writer = excluded.writer,
  published_at = excluded.published_at,
  status = excluded.status,
  updated_at = excluded.updated_at;

commit;

notify pgrst, 'reload schema';
