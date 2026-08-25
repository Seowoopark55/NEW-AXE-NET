-- AXE NET v1.28.2
-- 029_plika_accounts_csv_import.sql
-- 사용자 제공 `AXE NET - 플리카계좌.csv`를 new_axe_net.member_accounts로 1회 이관합니다.
--
-- SOURCE SUMMARY
--   원본 행: 21
--   현재 AXE NET 멤버와 연결 가능: 20
--   미연결: 1 (조까치 - 현재 new_axe_net.members에 해당 멤버 없음)
--
-- 전제:
--   026_assets_plika.sql 실행 완료
--
-- 정책:
-- - Google Sheet / Apps Script를 런타임에 연결하지 않습니다.
-- - member_key 기준 UPSERT이므로 027을 이미 실행했어도 중복 생성되지 않습니다.
-- - 원본의 사용여부를 그대로 보존합니다.
-- - 레거시 별칭 `옥순이`는 현재 멤버 `이옥순`, `형석`은 현재 멤버 `김형석`에 연결합니다.
-- - `조까치`는 현재 AXE NET members에 없으므로 계좌 행을 임의의 멤버에 연결하거나 멤버를 새로 만들지 않습니다.
-- - 원본 수정일은 검증용 source CTE에만 남기며 운영 테이블 스키마를 불필요하게 확장하지 않습니다.

WITH source (
  legacy_no,
  source_name,
  lookup_name,
  account,
  enabled,
  note,
  source_updated_at,
  sort_order
) AS (
  VALUES
    ('1', '조까치', '조까치', '134536315653', false, null, '2026-07-15 13:58', 1),
    ('2', '호듀', '호듀', '507944478720', true, null, null, 2),
    ('3', '백민훈', '백민훈', '484370233651', true, null, null, 3),
    ('4', '영포티', '영포티', '403364530400', true, null, '2026-05-24 11:40', 4),
    ('5', '얌이', '얌이', '178990537436', true, null, null, 5),
    ('6', '화윤', '화윤', '68451132680', true, 'Discord 관리자: 영포티', '2026-08-07 23:28', 6),
    ('7', '옥순이', '이옥순', '368516035477', false, null, '2026-06-09 21:30', 7),
    ('8', '키스', '키스', '424970610456', true, null, null, 8),
    ('9', '조창봉', '조창봉', '556244092923', true, null, null, 9),
    ('10', '만석침', '만석침', '598629732100', true, null, null, 10),
    ('11', '서팔광', '서팔광', '494208640524', true, null, null, 11),
    ('12', '김안녕', '김안녕', '209871733831', true, null, null, 12),
    ('13', '샹크스', '샹크스', '661467290668', true, null, null, 13),
    ('15', '벚꽃', '벚꽃', '880618800148', true, null, null, 15),
    ('16', '구만집', '구만집', '228623695195', true, null, '2026-05-24 15:40', 16),
    ('17', '곽철곤', '곽철곤', '229036970286', false, null, '2026-07-15 13:58', 17),
    ('18', '햇밥', '햇밥', '290605791719', true, 'Discord 관리자: 영포티', '2026-07-15 14:49', 18),
    ('19', '칭찬양파', '칭찬양파', '354452476543', true, 'Discord 관리자: 영포티', '2026-07-15 15:53', 19),
    ('20', '형석', '김형석', '445587286027', true, 'Discord 관리자: 영포티', '2026-07-15 23:03', 20),
    ('21', '박두억', '박두억', '428260434160', true, 'Discord 관리자: 영포티', '2026-07-24 17:08', 21),
    ('22', '김공찬', '김공찬', '22454782118', true, 'Discord 관리자: 영포티', '2026-08-05 14:03', 22)
),
resolved AS (
  SELECT
    s.*,
    (
      SELECT m.member_key
      FROM new_axe_net.members m
      WHERE lower(btrim(m.nickname)) = lower(btrim(s.lookup_name))
      ORDER BY
        CASE WHEN m.status = 'active' THEN 0 ELSE 1 END,
        m.id
      LIMIT 1
    ) AS member_key
  FROM source s
)
INSERT INTO new_axe_net.member_accounts (
  member_key,
  account,
  enabled,
  note,
  sort_order
)
SELECT
  r.member_key,
  r.account,
  r.enabled,
  r.note,
  r.sort_order
FROM resolved r
WHERE r.member_key IS NOT NULL
ON CONFLICT (member_key)
DO UPDATE SET
  account = excluded.account,
  enabled = excluded.enabled,
  note = excluded.note,
  sort_order = excluded.sort_order,
  updated_at = now();

-- =========================================================
-- 검증 1: 이관 결과 요약
-- =========================================================

WITH source (
  legacy_no,
  source_name,
  lookup_name,
  account,
  enabled,
  note,
  source_updated_at,
  sort_order
) AS (
  VALUES
    ('1', '조까치', '조까치', '134536315653', false, null, '2026-07-15 13:58', 1),
    ('2', '호듀', '호듀', '507944478720', true, null, null, 2),
    ('3', '백민훈', '백민훈', '484370233651', true, null, null, 3),
    ('4', '영포티', '영포티', '403364530400', true, null, '2026-05-24 11:40', 4),
    ('5', '얌이', '얌이', '178990537436', true, null, null, 5),
    ('6', '화윤', '화윤', '68451132680', true, 'Discord 관리자: 영포티', '2026-08-07 23:28', 6),
    ('7', '옥순이', '이옥순', '368516035477', false, null, '2026-06-09 21:30', 7),
    ('8', '키스', '키스', '424970610456', true, null, null, 8),
    ('9', '조창봉', '조창봉', '556244092923', true, null, null, 9),
    ('10', '만석침', '만석침', '598629732100', true, null, null, 10),
    ('11', '서팔광', '서팔광', '494208640524', true, null, null, 11),
    ('12', '김안녕', '김안녕', '209871733831', true, null, null, 12),
    ('13', '샹크스', '샹크스', '661467290668', true, null, null, 13),
    ('15', '벚꽃', '벚꽃', '880618800148', true, null, null, 15),
    ('16', '구만집', '구만집', '228623695195', true, null, '2026-05-24 15:40', 16),
    ('17', '곽철곤', '곽철곤', '229036970286', false, null, '2026-07-15 13:58', 17),
    ('18', '햇밥', '햇밥', '290605791719', true, 'Discord 관리자: 영포티', '2026-07-15 14:49', 18),
    ('19', '칭찬양파', '칭찬양파', '354452476543', true, 'Discord 관리자: 영포티', '2026-07-15 15:53', 19),
    ('20', '형석', '김형석', '445587286027', true, 'Discord 관리자: 영포티', '2026-07-15 23:03', 20),
    ('21', '박두억', '박두억', '428260434160', true, 'Discord 관리자: 영포티', '2026-07-24 17:08', 21),
    ('22', '김공찬', '김공찬', '22454782118', true, 'Discord 관리자: 영포티', '2026-08-05 14:03', 22)
),
resolved AS (
  SELECT
    s.*,
    (
      SELECT m.member_key
      FROM new_axe_net.members m
      WHERE lower(btrim(m.nickname)) = lower(btrim(s.lookup_name))
      ORDER BY
        CASE WHEN m.status = 'active' THEN 0 ELSE 1 END,
        m.id
      LIMIT 1
    ) AS member_key
  FROM source s
)
SELECT
  count(*) AS source_rows,
  count(*) FILTER (WHERE member_key IS NOT NULL) AS resolved_rows,
  count(*) FILTER (WHERE member_key IS NULL) AS unresolved_rows,
  count(*) FILTER (WHERE member_key IS NOT NULL AND enabled) AS imported_enabled,
  count(*) FILTER (WHERE member_key IS NOT NULL AND NOT enabled) AS imported_disabled
FROM resolved;

-- 기대값:
-- source_rows = 21
-- resolved_rows = 20
-- unresolved_rows = 1
-- imported_enabled = 18
-- imported_disabled = 2

-- =========================================================
-- 검증 2: 미연결 원본 확인
-- =========================================================

WITH source (
  legacy_no,
  source_name,
  lookup_name,
  account,
  enabled,
  note,
  source_updated_at,
  sort_order
) AS (
  VALUES
    ('1', '조까치', '조까치', '134536315653', false, null, '2026-07-15 13:58', 1),
    ('2', '호듀', '호듀', '507944478720', true, null, null, 2),
    ('3', '백민훈', '백민훈', '484370233651', true, null, null, 3),
    ('4', '영포티', '영포티', '403364530400', true, null, '2026-05-24 11:40', 4),
    ('5', '얌이', '얌이', '178990537436', true, null, null, 5),
    ('6', '화윤', '화윤', '68451132680', true, 'Discord 관리자: 영포티', '2026-08-07 23:28', 6),
    ('7', '옥순이', '이옥순', '368516035477', false, null, '2026-06-09 21:30', 7),
    ('8', '키스', '키스', '424970610456', true, null, null, 8),
    ('9', '조창봉', '조창봉', '556244092923', true, null, null, 9),
    ('10', '만석침', '만석침', '598629732100', true, null, null, 10),
    ('11', '서팔광', '서팔광', '494208640524', true, null, null, 11),
    ('12', '김안녕', '김안녕', '209871733831', true, null, null, 12),
    ('13', '샹크스', '샹크스', '661467290668', true, null, null, 13),
    ('15', '벚꽃', '벚꽃', '880618800148', true, null, null, 15),
    ('16', '구만집', '구만집', '228623695195', true, null, '2026-05-24 15:40', 16),
    ('17', '곽철곤', '곽철곤', '229036970286', false, null, '2026-07-15 13:58', 17),
    ('18', '햇밥', '햇밥', '290605791719', true, 'Discord 관리자: 영포티', '2026-07-15 14:49', 18),
    ('19', '칭찬양파', '칭찬양파', '354452476543', true, 'Discord 관리자: 영포티', '2026-07-15 15:53', 19),
    ('20', '형석', '김형석', '445587286027', true, 'Discord 관리자: 영포티', '2026-07-15 23:03', 20),
    ('21', '박두억', '박두억', '428260434160', true, 'Discord 관리자: 영포티', '2026-07-24 17:08', 21),
    ('22', '김공찬', '김공찬', '22454782118', true, 'Discord 관리자: 영포티', '2026-08-05 14:03', 22)
),
resolved AS (
  SELECT
    s.*,
    (
      SELECT m.member_key
      FROM new_axe_net.members m
      WHERE lower(btrim(m.nickname)) = lower(btrim(s.lookup_name))
      ORDER BY
        CASE WHEN m.status = 'active' THEN 0 ELSE 1 END,
        m.id
      LIMIT 1
    ) AS member_key
  FROM source s
)
SELECT
  legacy_no,
  source_name,
  lookup_name,
  enabled,
  source_updated_at
FROM resolved
WHERE member_key IS NULL
ORDER BY sort_order;

-- 기대: 조까치 1건

-- =========================================================
-- 검증 3: 실제 AXE NET 계좌 목록
-- 계좌번호 자체는 SQL Editor에서만 확인하고 외부 공유하지 마세요.
-- =========================================================

SELECT
  ma.sort_order,
  m.nickname,
  m.status AS member_status,
  ma.enabled,
  ma.note,
  ma.updated_at
FROM new_axe_net.member_accounts ma
JOIN new_axe_net.members m
  ON m.member_key = ma.member_key
ORDER BY ma.sort_order, ma.id;

notify pgrst, 'reload schema';
