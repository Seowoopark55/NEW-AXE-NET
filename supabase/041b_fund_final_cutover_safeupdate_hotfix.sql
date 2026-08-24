-- NEW AXE NET / FUND FINAL CUTOVER V11.1 HOTFIX
-- Supabase pg-safeupdate 대응: 전체 DELETE/UPDATE에 명시적 WHERE 조건 추가
-- 기존 041을 이미 실행한 DB에서 이 SQL만 실행하면 됩니다.
-- 데이터 자체를 수정하지 않고 apply_current_axe_fund_snapshot 함수 정의만 교체합니다.

do $hotfix$
declare
  v_sql text;
begin
  select pg_get_functiondef('new_axe_net.apply_current_axe_fund_snapshot(jsonb)'::regprocedure)
    into v_sql;

  if v_sql is null then
    raise exception 'apply_current_axe_fund_snapshot(jsonb) 함수를 찾을 수 없습니다. 먼저 041 SQL이 적용되어 있어야 합니다.';
  end if;

  -- pg-safeupdate: DELETE requires a WHERE clause
  v_sql := replace(v_sql,
    'delete from new_axe_net.fund_ledger;',
    'delete from new_axe_net.fund_ledger where true;');
  v_sql := replace(v_sql,
    'delete from new_axe_net.fund_requests;',
    'delete from new_axe_net.fund_requests where true;');
  v_sql := replace(v_sql,
    'delete from new_axe_net.fund_exemptions;',
    'delete from new_axe_net.fund_exemptions where true;');
  v_sql := replace(v_sql,
    'delete from new_axe_net.fund_fee_rules;',
    'delete from new_axe_net.fund_fee_rules where true;');
  v_sql := replace(v_sql,
    'delete from new_axe_net.fund_status_snapshot;',
    'delete from new_axe_net.fund_status_snapshot where true;');

  -- 같은 보호 기능이 UPDATE에도 적용될 수 있으므로 함께 보정
  v_sql := replace(v_sql,
$old_update$  update new_axe_net.fund_member_settings
  set enabled = false,
      note = case when note is null then 'Final cutover: current AXE NET 비대상' else note end,
      updated_by = 'AXE BOT FINAL CUTOVER',
      updated_at = v_now;$old_update$,
$new_update$  update new_axe_net.fund_member_settings
  set enabled = false,
      note = case when note is null then 'Final cutover: current AXE NET 비대상' else note end,
      updated_by = 'AXE BOT FINAL CUTOVER',
      updated_at = v_now
  where true;$new_update$
  );

  -- 패치가 실제 반영됐는지 검증
  if position('delete from new_axe_net.fund_ledger where true;' in v_sql) = 0
     or position('delete from new_axe_net.fund_requests where true;' in v_sql) = 0
     or position('delete from new_axe_net.fund_exemptions where true;' in v_sql) = 0
     or position('delete from new_axe_net.fund_fee_rules where true;' in v_sql) = 0
     or position('delete from new_axe_net.fund_status_snapshot where true;' in v_sql) = 0
     or position($check_update$updated_at = v_now
  where true;$check_update$ in v_sql) = 0 then
    raise exception 'V11.1 safe-update 패치가 함수 정의에 반영되지 않았습니다. 실행을 중단합니다.';
  end if;

  execute v_sql;
end
$hotfix$;

revoke all on function new_axe_net.apply_current_axe_fund_snapshot(jsonb)
from public, anon, authenticated;
grant execute on function new_axe_net.apply_current_axe_fund_snapshot(jsonb)
to service_role;

notify pgrst, 'reload schema';

-- 확인: 4개가 모두 true면 완료
select
  to_regprocedure('new_axe_net.apply_current_axe_fund_snapshot(jsonb)') is not null as function_ready,
  position(
    'delete from new_axe_net.fund_ledger where true;'
    in pg_get_functiondef('new_axe_net.apply_current_axe_fund_snapshot(jsonb)'::regprocedure)
  ) > 0 as safe_delete_ready,
  position(
$check_update$updated_at = v_now
  where true;$check_update$
    in pg_get_functiondef('new_axe_net.apply_current_axe_fund_snapshot(jsonb)'::regprocedure)
  ) > 0 as safe_update_ready,
  (select primary_source = 'legacy' from new_axe_net.fund_runtime_config where id = 1) as still_legacy_before_retry;
