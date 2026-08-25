-- AXE NET v1.28.1
-- 028_assets_legacy_import.sql
-- 기존 Google Sheet CSV의 회사자산 / 퇴사자반납 데이터를 new_axe_net로 1회 이관합니다.
--
-- SOURCE
--   AXE NET - 회사자산.csv : 22 rows
--   AXE NET - 퇴사자반납.csv : 3 rows
--
-- 전제:
--   026_assets_plika.sql 실행 완료
--
-- 정책:
-- - Google Sheet / Apps Script를 런타임에 연결하지 않습니다.
-- - legacy_no를 기준으로 기존 행은 갱신하고 없는 행만 삽입하므로 재실행해도 중복되지 않습니다.
-- - 회사자산의 기존 취득일 YY/MM은 정확한 '일' 정보가 없으므로 해당 월 1일로 저장합니다.
--   v1.28.1 UI에서는 legacy 행의 YYYY-MM-01을 YYYY-MM로 표시해 거짓 일자 정밀도를 피합니다.
-- - 퇴사자반납의 MM/DD 두 행은 2026년 데이터로 해석합니다.
--   이옥순 06/09는 members.resigned_at=2026-06-09와도 일치합니다.
-- - legacy '야미'는 현재 AXE NET 멤버 닉네임 '얌이'와 연결합니다.
-- - '미배정' 자산은 member_key=NULL로 유지합니다.

-- =========================================================
-- 1) 회사자산 22건
-- =========================================================

WITH source (
  legacy_no,
  owner_name,
  member_lookup_name,
  asset_category,
  asset_name,
  acquisition_method,
  acquired_at,
  personal_cost,
  status,
  note,
  sort_order
) AS (
  VALUES
    ('1', '백민훈', '백민훈', '총기류', '이단 산타 리볼버(+5)', '보스', '2026-01-01'::date, 180000, '보유중', '개조서O', 1),
    ('2', '야미', '얌이', '총기류', '이단 산타 리볼버(+3)', '보스', '2025-12-01'::date, null::bigint, '보유중', '개조서O', 2),
    ('4', '호듀', '호듀', '총기류', '이단 산타 리볼버(??)', '보스', '2025-12-01'::date, 140000, '보유중', '개조서O', 4),
    ('5', '영포티', '영포티', '총기류', '이단 산타 리볼버(+0)', '보스', '2025-12-01'::date, 140000, '보유중', '개조서O', 5),
    ('6', '샹크스', '샹크스', '총기류', '이단 산타 리볼버(+2)', '보스', '2026-05-01'::date, 140000, '보유중', '개조서O', 6),
    ('7', '호듀', '호듀', '총기류', 'SMG', '무법지대', '2026-02-01'::date, 35000, '보유중', '개조서O', 7),
    ('9', '화윤', '화윤', '총기류', '이단 산타 리볼버(+2)', '보스', '2026-02-01'::date, 130000, '보유중', '개조서O', 9),
    ('10', '만석침', '만석침', '총기류', '이단 산타 리볼버(+5)', '보스', '2026-02-01'::date, 200000, '보유중', '개조서O', 10),
    ('11', '영포티', '영포티', '총기류', '컴뱃 PDW (SMG)(+2)', '무법지대', '2026-03-01'::date, 35000, '보유중', '개조서O', 11),
    ('12', '야미', '얌이', '총기류', '핑크 SMG+3', '무법지대', '2026-04-01'::date, 35000, '보유중', '개조서O', 12),
    ('13', '화윤', '화윤', '총기류', 'SMG(+2)', '무법지대', '2026-04-01'::date, 35000, '보유중', '개조서O', 13),
    ('14', '박두억', '박두억', '총기류', 'SMG+2', '무법지대', '2026-05-01'::date, 35000, '보유중', '개조서O', 14),
    ('15', '샹크스', '샹크스', '총기류', 'SMG+3', '무법지대', '2026-05-01'::date, 35001, '보유중', '개조서O', 15),
    ('17', '조창봉', '조창봉', '총기류', 'SMG', '무법지대', '2026-05-01'::date, 35000, '보유중', '개조서O', 17),
    ('18', '만석침', '만석침', '총기류', 'SMG', '무법지대', '2026-05-01'::date, 35000, '보유중', '개조서O', 18),
    ('19', '미배정', null, '총기류', '리버스 샷건', '기타', '2026-06-01'::date, null::bigint, '미배정 총기', '전쟁으로 얻은 리버스 샷건 비용 추후 추가예정', 19),
    ('20', '미배정', null, '총기류', '리버스 샷건+1', '기타', '2026-06-01'::date, null::bigint, '미배정 총기', '전쟁으로 얻은 리버스 샷건 비용 추후 추가예정', 20),
    ('21', '김안녕', '김안녕', '총기류', 'SMG(+0)', '무법지대', '2026-07-01'::date, 35000, '보유중', null, 21),
    ('22', '미배정', null, '총기류', '리버스 샷건', '기타', '2026-07-01'::date, null::bigint, '미배정 총기', '전쟁으로 얻은 리버스 샷건 비용 추후 추가예정', 22),
    ('23', '백민훈', '백민훈', '총기류', 'PDW+1', '무법지대', '2026-08-01'::date, 35000, '보유중', null, 23),
    ('24', '벚꽃', '벚꽃', '총기류', 'SMG+3', '무법지대', '2026-08-01'::date, 35000, '보유중', null, 24),
    ('25', '구만집', '구만집', '총기류', 'SMG+3', '무법지대', '2026-08-01'::date, 35000, '보유중', null, 25)
),
resolved AS (
  SELECT
    s.*,
    (
      SELECT m.member_key
      FROM new_axe_net.members m
      WHERE s.member_lookup_name IS NOT NULL
        AND lower(btrim(m.nickname)) = lower(btrim(s.member_lookup_name))
      ORDER BY m.id
      LIMIT 1
    ) AS member_key
  FROM source s
)
UPDATE new_axe_net.company_assets a
SET
  member_key = r.member_key,
  owner_name = r.owner_name,
  asset_category = r.asset_category,
  asset_name = r.asset_name,
  acquisition_method = r.acquisition_method,
  acquired_at = r.acquired_at,
  personal_cost = r.personal_cost,
  status = r.status,
  note = r.note,
  active = true,
  sort_order = r.sort_order,
  updated_at = now()
FROM resolved r
WHERE a.legacy_no = r.legacy_no;

WITH source (
  legacy_no,
  owner_name,
  member_lookup_name,
  asset_category,
  asset_name,
  acquisition_method,
  acquired_at,
  personal_cost,
  status,
  note,
  sort_order
) AS (
  VALUES
    ('1', '백민훈', '백민훈', '총기류', '이단 산타 리볼버(+5)', '보스', '2026-01-01'::date, 180000, '보유중', '개조서O', 1),
    ('2', '야미', '얌이', '총기류', '이단 산타 리볼버(+3)', '보스', '2025-12-01'::date, null::bigint, '보유중', '개조서O', 2),
    ('4', '호듀', '호듀', '총기류', '이단 산타 리볼버(??)', '보스', '2025-12-01'::date, 140000, '보유중', '개조서O', 4),
    ('5', '영포티', '영포티', '총기류', '이단 산타 리볼버(+0)', '보스', '2025-12-01'::date, 140000, '보유중', '개조서O', 5),
    ('6', '샹크스', '샹크스', '총기류', '이단 산타 리볼버(+2)', '보스', '2026-05-01'::date, 140000, '보유중', '개조서O', 6),
    ('7', '호듀', '호듀', '총기류', 'SMG', '무법지대', '2026-02-01'::date, 35000, '보유중', '개조서O', 7),
    ('9', '화윤', '화윤', '총기류', '이단 산타 리볼버(+2)', '보스', '2026-02-01'::date, 130000, '보유중', '개조서O', 9),
    ('10', '만석침', '만석침', '총기류', '이단 산타 리볼버(+5)', '보스', '2026-02-01'::date, 200000, '보유중', '개조서O', 10),
    ('11', '영포티', '영포티', '총기류', '컴뱃 PDW (SMG)(+2)', '무법지대', '2026-03-01'::date, 35000, '보유중', '개조서O', 11),
    ('12', '야미', '얌이', '총기류', '핑크 SMG+3', '무법지대', '2026-04-01'::date, 35000, '보유중', '개조서O', 12),
    ('13', '화윤', '화윤', '총기류', 'SMG(+2)', '무법지대', '2026-04-01'::date, 35000, '보유중', '개조서O', 13),
    ('14', '박두억', '박두억', '총기류', 'SMG+2', '무법지대', '2026-05-01'::date, 35000, '보유중', '개조서O', 14),
    ('15', '샹크스', '샹크스', '총기류', 'SMG+3', '무법지대', '2026-05-01'::date, 35001, '보유중', '개조서O', 15),
    ('17', '조창봉', '조창봉', '총기류', 'SMG', '무법지대', '2026-05-01'::date, 35000, '보유중', '개조서O', 17),
    ('18', '만석침', '만석침', '총기류', 'SMG', '무법지대', '2026-05-01'::date, 35000, '보유중', '개조서O', 18),
    ('19', '미배정', null, '총기류', '리버스 샷건', '기타', '2026-06-01'::date, null::bigint, '미배정 총기', '전쟁으로 얻은 리버스 샷건 비용 추후 추가예정', 19),
    ('20', '미배정', null, '총기류', '리버스 샷건+1', '기타', '2026-06-01'::date, null::bigint, '미배정 총기', '전쟁으로 얻은 리버스 샷건 비용 추후 추가예정', 20),
    ('21', '김안녕', '김안녕', '총기류', 'SMG(+0)', '무법지대', '2026-07-01'::date, 35000, '보유중', null, 21),
    ('22', '미배정', null, '총기류', '리버스 샷건', '기타', '2026-07-01'::date, null::bigint, '미배정 총기', '전쟁으로 얻은 리버스 샷건 비용 추후 추가예정', 22),
    ('23', '백민훈', '백민훈', '총기류', 'PDW+1', '무법지대', '2026-08-01'::date, 35000, '보유중', null, 23),
    ('24', '벚꽃', '벚꽃', '총기류', 'SMG+3', '무법지대', '2026-08-01'::date, 35000, '보유중', null, 24),
    ('25', '구만집', '구만집', '총기류', 'SMG+3', '무법지대', '2026-08-01'::date, 35000, '보유중', null, 25)
),
resolved AS (
  SELECT
    s.*,
    (
      SELECT m.member_key
      FROM new_axe_net.members m
      WHERE s.member_lookup_name IS NOT NULL
        AND lower(btrim(m.nickname)) = lower(btrim(s.member_lookup_name))
      ORDER BY m.id
      LIMIT 1
    ) AS member_key
  FROM source s
)
INSERT INTO new_axe_net.company_assets (
  legacy_no,
  member_key,
  owner_name,
  asset_category,
  asset_name,
  acquisition_method,
  acquired_at,
  personal_cost,
  status,
  note,
  active,
  sort_order
)
SELECT
  r.legacy_no,
  r.member_key,
  r.owner_name,
  r.asset_category,
  r.asset_name,
  r.acquisition_method,
  r.acquired_at,
  r.personal_cost,
  r.status,
  r.note,
  true,
  r.sort_order
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM new_axe_net.company_assets a
  WHERE a.legacy_no = r.legacy_no
);

-- =========================================================
-- 2) 퇴사자/자산 반납 3건
-- =========================================================

WITH source (
  legacy_no,
  owner_name,
  member_lookup_name,
  asset_name,
  returned,
  checker,
  processed_at,
  note
) AS (
  VALUES
    ('1', '박두억', '박두억', '이단 산타 리볼버(+2)', true, '영포티', '2026-05-03'::date, null),
    ('2', '이옥순', '이옥순', 'SMG', true, '영포티', '2026-06-09'::date, null),
    ('3', '키스', '키스', 'SMG', true, 'admin', '2026-08-17'::date, '2026-08-17 07:24 키스 퇴사로 자동 미배정 전환')
),
resolved AS (
  SELECT
    s.*,
    (
      SELECT m.member_key
      FROM new_axe_net.members m
      WHERE s.member_lookup_name IS NOT NULL
        AND lower(btrim(m.nickname)) = lower(btrim(s.member_lookup_name))
      ORDER BY m.id
      LIMIT 1
    ) AS member_key
  FROM source s
)
UPDATE new_axe_net.company_asset_returns r
SET
  asset_id = NULL,
  member_key = s.member_key,
  owner_name = s.owner_name,
  asset_name = s.asset_name,
  returned = s.returned,
  checker = s.checker,
  processed_at = s.processed_at,
  note = s.note,
  active = true,
  updated_at = now()
FROM resolved s
WHERE r.legacy_no = s.legacy_no;

WITH source (
  legacy_no,
  owner_name,
  member_lookup_name,
  asset_name,
  returned,
  checker,
  processed_at,
  note
) AS (
  VALUES
    ('1', '박두억', '박두억', '이단 산타 리볼버(+2)', true, '영포티', '2026-05-03'::date, null),
    ('2', '이옥순', '이옥순', 'SMG', true, '영포티', '2026-06-09'::date, null),
    ('3', '키스', '키스', 'SMG', true, 'admin', '2026-08-17'::date, '2026-08-17 07:24 키스 퇴사로 자동 미배정 전환')
),
resolved AS (
  SELECT
    s.*,
    (
      SELECT m.member_key
      FROM new_axe_net.members m
      WHERE s.member_lookup_name IS NOT NULL
        AND lower(btrim(m.nickname)) = lower(btrim(s.member_lookup_name))
      ORDER BY m.id
      LIMIT 1
    ) AS member_key
  FROM source s
)
INSERT INTO new_axe_net.company_asset_returns (
  legacy_no,
  asset_id,
  member_key,
  owner_name,
  asset_name,
  returned,
  checker,
  processed_at,
  note,
  active
)
SELECT
  s.legacy_no,
  NULL,
  s.member_key,
  s.owner_name,
  s.asset_name,
  s.returned,
  s.checker,
  s.processed_at,
  s.note,
  true
FROM resolved s
WHERE NOT EXISTS (
  SELECT 1
  FROM new_axe_net.company_asset_returns r
  WHERE r.legacy_no = s.legacy_no
);

-- =========================================================
-- 3) 검증
-- =========================================================

SELECT
  count(*) AS imported_assets,
  count(*) FILTER (WHERE member_key IS NOT NULL) AS linked_assets,
  count(*) FILTER (WHERE member_key IS NULL) AS unlinked_assets,
  sum(coalesce(personal_cost, 0)) AS personal_cost_total
FROM new_axe_net.company_assets
WHERE legacy_no IN ('1', '2', '4', '5', '6', '7', '9', '10', '11', '12', '13', '14', '15', '17', '18', '19', '20', '21', '22', '23', '24', '25');

SELECT
  count(*) AS imported_returns,
  count(*) FILTER (WHERE member_key IS NOT NULL) AS linked_returns,
  count(*) FILTER (WHERE returned) AS completed_returns
FROM new_axe_net.company_asset_returns
WHERE legacy_no IN ('1', '2', '3');

-- 기대값:
-- imported_assets = 22
-- linked_assets = 19
-- unlinked_assets = 3   -- 미배정 3건
-- imported_returns = 3
-- linked_returns = 3
-- completed_returns = 3

-- legacy '야미' -> current '얌이' 연결 확인
SELECT
  a.legacy_no,
  a.owner_name AS legacy_owner_name,
  m.nickname AS linked_member_nickname,
  a.asset_name
FROM new_axe_net.company_assets a
LEFT JOIN new_axe_net.members m
  ON m.member_key = a.member_key
WHERE a.owner_name = '야미'
ORDER BY a.sort_order;

notify pgrst, 'reload schema';
