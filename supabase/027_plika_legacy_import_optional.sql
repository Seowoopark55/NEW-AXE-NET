-- NEW AXE NET v1.28.0
-- 027_plika_legacy_import_optional.sql
-- 선택 실행: 기존 AXE WAR/public.member_accounts -> NEW AXE NET 계좌 1회 복사
--
-- 이 SQL은 public 데이터를 수정하지 않습니다.
-- NEW AXE NET 런타임도 public을 읽지 않습니다.
-- 026_assets_plika.sql 실행 후, 기존 public.member_accounts가 있는 경우에만 실행하세요.

DO $$
DECLARE
  v_imported integer := 0;
BEGIN
  IF to_regclass('public.member_accounts') IS NULL THEN
    RAISE NOTICE 'public.member_accounts가 없어 가져오기를 건너뜁니다.';
    RETURN;
  END IF;

  WITH source_rows AS (
    SELECT
      NULLIF(btrim(coalesce(p.member_key, '')), '') AS legacy_member_key,
      NULLIF(btrim(coalesce(p.nickname, '')), '') AS nickname,
      NULLIF(btrim(coalesce(p.account_number, '')), '') AS account_number,
      coalesce(p.enabled, true) AS enabled,
      coalesce(p."order", 0)::integer AS sort_order
    FROM public.member_accounts p
    WHERE NULLIF(btrim(coalesce(p.account_number, '')), '') IS NOT NULL
  ), matched AS (
    SELECT DISTINCT ON (s.nickname, s.legacy_member_key)
      m.member_key,
      s.account_number,
      s.enabled,
      s.sort_order
    FROM source_rows s
    JOIN new_axe_net.members m
      ON lower(btrim(m.nickname)) = lower(btrim(s.nickname))
      OR m.member_key = s.legacy_member_key
    ORDER BY s.nickname, s.legacy_member_key,
      CASE WHEN lower(btrim(m.nickname)) = lower(btrim(s.nickname)) THEN 0 ELSE 1 END,
      m.id
  ), upserted AS (
    INSERT INTO new_axe_net.member_accounts (
      member_key, account, enabled, sort_order
    )
    SELECT member_key, account_number, enabled, sort_order
    FROM matched
    ON CONFLICT (member_key) DO UPDATE
      SET account = excluded.account,
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_imported FROM upserted;

  RAISE NOTICE 'NEW AXE NET 플리카 계좌 %건 복사 완료', v_imported;
END
$$;

-- 실행 후 확인
select
  count(*) as new_axe_net_accounts,
  count(*) filter (where enabled) as enabled_accounts
from new_axe_net.member_accounts;
