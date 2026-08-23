-- NEW AXE NET v1.17.0 · FUND REBASE PARITY
-- 019_fund_rebase_parity.sql
-- Supabase SQL Editor에서 한 번만 전체 실행하세요.
--
-- 기존 AXE NET 기준으로 복원/보강하는 항목
-- 1) 기간형 공금 면제 + range_key 묶음 관리
-- 2) 검수 보류(hold)
-- 3) 전체선택/선택 일괄승인용 트랜잭션 RPC
-- 4) pending + hold를 모두 '처리 중 신청'으로 취급
-- 5) 월별현황/월집계/정합성점검에서 hold 상태까지 동일 반영

-- =========================================================
-- 1) 기간 면제 패리티
-- =========================================================
alter table new_axe_net.fund_exemptions
  add column if not exists range_key text;

-- 기존 AXE NET에서 기간 면제 1건이 주차별 행으로 이관된 데이터는
-- source_key의 원래 exemption id가 같으므로 다시 하나의 range로 묶습니다.
update new_axe_net.fund_exemptions
set range_key =
  'legacy:' || regexp_replace(
    source_key,
    ':[0-9]{4}-[0-9]{2}:w[1-5]$',
    ''
  )
where range_key is null
  and source_key ~ '^sheet_exempt:.*:[0-9]{4}-[0-9]{2}:w[1-5]$';

create index if not exists fund_exemptions_range_key_idx
on new_axe_net.fund_exemptions (range_key)
where range_key is not null;

create or replace function new_axe_net.create_fund_exemption_range(
  p_member_key text,
  p_start_year integer,
  p_start_month integer,
  p_start_week integer,
  p_end_year integer,
  p_end_month integer,
  p_end_week integer,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_end date;
  v_end_end date;
  v_nickname text;
  v_actor text;
  v_range_key text;
  v_inserted integer := 0;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  v_start_end := new_axe_net.fund_period_end(
    p_start_year,
    p_start_month,
    p_start_week
  );
  v_end_end := new_axe_net.fund_period_end(
    p_end_year,
    p_end_month,
    p_end_week
  );

  if v_start_end is null then
    raise exception '존재하지 않는 면제 시작 주차입니다.'
      using errcode = '22023';
  end if;

  if v_end_end is null then
    raise exception '존재하지 않는 면제 종료 주차입니다.'
      using errcode = '22023';
  end if;

  if v_start_end > v_end_end then
    raise exception '면제 종료 기간은 시작 기간보다 빠를 수 없습니다.'
      using errcode = '22023';
  end if;

  select m.nickname
    into v_nickname
  from new_axe_net.members m
  where m.member_key = p_member_key
    and m.status = 'active'
  limit 1;

  if v_nickname is null then
    raise exception '활동 중인 멤버를 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  -- 기간 안에 기존 활성 면제가 하나라도 있으면 중복 등록을 막습니다.
  if exists (
    select 1
    from new_axe_net.fund_exemptions e
    where e.member_key = p_member_key
      and e.enabled = true
      and new_axe_net.fund_period_end(e.year, e.month, e.week)
        between v_start_end and v_end_end
  ) then
    raise exception '같은 멤버의 기존 면제 기간과 겹칩니다. 기존 면제를 해제하거나 기간을 조정해주세요.'
      using errcode = '23505';
  end if;

  -- 기존 AXE NET과 동일하게 검수대기/승인 신청이 걸린 기간은 먼저 정리합니다.
  if exists (
    select 1
    from new_axe_net.fund_requests r
    where r.member_key = p_member_key
      and r.status in ('pending', 'hold', 'approved')
      and new_axe_net.fund_period_end(r.year, r.month, r.week)
        between v_start_end and v_end_end
  ) then
    raise exception '선택 기간에 검수대기·보류·승인 신청이 있습니다. 해당 신청을 먼저 처리한 뒤 면제를 등록해주세요.'
      using errcode = '23514';
  end if;

  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');
  v_range_key :=
    'fund_exempt_range:' ||
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text ||
    ':' || substr(md5(random()::text || p_member_key || clock_timestamp()::text), 1, 12);

  with month_series as (
    select d::date as month_start
    from generate_series(
      date_trunc('month', v_start_end)::timestamp,
      date_trunc('month', v_end_end)::timestamp,
      interval '1 month'
    ) d
  ), candidate_periods as (
    select
      extract(year from m.month_start)::integer as year,
      extract(month from m.month_start)::integer as month,
      w.week,
      new_axe_net.fund_period_end(
        extract(year from m.month_start)::integer,
        extract(month from m.month_start)::integer,
        w.week
      ) as period_end
    from month_series m
    cross join (values (1), (2), (3), (4), (5)) as w(week)
  ), target_periods as (
    select year, month, week, period_end
    from candidate_periods
    where period_end is not null
      and period_end between v_start_end and v_end_end
  )
  insert into new_axe_net.fund_exemptions (
    member_key,
    nickname,
    year,
    month,
    week,
    exemption_type,
    range_key,
    reason,
    enabled,
    source_key,
    created_by
  )
  select
    p_member_key,
    v_nickname,
    p.year,
    p.month,
    p.week,
    'range',
    v_range_key,
    nullif(btrim(p_reason), ''),
    true,
    v_range_key || ':' || p.year::text || '-' || p.month::text || '-' || p.week::text,
    v_actor
  from target_periods p
  order by p.period_end;

  get diagnostics v_inserted = row_count;

  if v_inserted <= 0 then
    raise exception '면제로 등록할 주차를 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  insert into new_axe_net.fund_admin_audit_log (
    action,
    target_type,
    target_key,
    actor_user_id,
    actor_nickname,
    payload
  )
  values (
    'create_exemption_range',
    'fund_exemption_range',
    v_range_key,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'member_key', p_member_key,
      'nickname', v_nickname,
      'start_year', p_start_year,
      'start_month', p_start_month,
      'start_week', p_start_week,
      'end_year', p_end_year,
      'end_month', p_end_month,
      'end_week', p_end_week,
      'reason', nullif(btrim(p_reason), ''),
      'inserted_periods', v_inserted
    )
  );

  return v_range_key;
end;
$$;

create or replace function new_axe_net.disable_fund_exemption_range(
  p_range_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_member_key text;
  v_nickname text;
  v_reason text;
  v_disabled integer := 0;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_range_key), '') is null then
    raise exception '해제할 면제 기간 정보가 없습니다.'
      using errcode = '22023';
  end if;

  select e.member_key, e.nickname, e.reason
    into v_member_key, v_nickname, v_reason
  from new_axe_net.fund_exemptions e
  where e.range_key = p_range_key
    and e.enabled = true
  order by e.year, e.month, e.week
  limit 1
  for update;

  if not found then
    raise exception '활성 면제 기간을 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  update new_axe_net.fund_exemptions
  set enabled = false
  where range_key = p_range_key
    and enabled = true;

  get diagnostics v_disabled = row_count;
  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');

  insert into new_axe_net.fund_admin_audit_log (
    action,
    target_type,
    target_key,
    actor_user_id,
    actor_nickname,
    payload
  )
  values (
    'disable_exemption_range',
    'fund_exemption_range',
    p_range_key,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'member_key', v_member_key,
      'nickname', v_nickname,
      'reason', v_reason,
      'disabled_periods', v_disabled
    )
  );

  return v_disabled;
end;
$$;

revoke all on function new_axe_net.create_fund_exemption_range(
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text
) from public, anon;

grant execute on function new_axe_net.create_fund_exemption_range(
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text
) to authenticated;

revoke all on function new_axe_net.disable_fund_exemption_range(text)
from public, anon;

grant execute on function new_axe_net.disable_fund_exemption_range(text)
to authenticated;


-- =========================================================
-- 2) 검수 상태 패리티: pending / hold / approved / rejected / deleted
-- =========================================================

alter table new_axe_net.fund_requests
  drop constraint if exists fund_requests_status_check;

alter table new_axe_net.fund_requests
  add constraint fund_requests_status_check
  check (status in ('pending', 'hold', 'approved', 'rejected', 'deleted'));

drop index if exists new_axe_net.fund_requests_one_pending_period_idx;
drop index if exists new_axe_net.fund_requests_one_open_period_idx;

create unique index fund_requests_one_open_period_idx
on new_axe_net.fund_requests (
  member_key,
  year,
  month,
  week
)
where status in ('pending', 'hold');

-- =========================================================
-- 3) 제출 중복 차단: hold도 처리 중으로 간주
-- =========================================================

create or replace function new_axe_net.submit_fund_request_v2(
  p_member_key text,
  p_discord_user_id text,
  p_year integer,
  p_month integer,
  p_week integer,
  p_amount integer default null,
  p_payment_mode text default '공용계좌',
  p_public_amount integer default null,
  p_company_amount integer default null,
  p_evidence_url text default null,
  p_memo text default null,
  p_submitted_by_name text default null,
  p_proxy_admin_name text default null,
  p_submitted_via text default 'web'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_member new_axe_net.members%rowtype;
  v_amount integer;
  v_public integer := 0;
  v_company integer := 0;
  v_source_key text;
  v_period_end date;
  v_period_start date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if nullif(btrim(p_discord_user_id), '') is null then
    raise exception 'Discord 계정연동 정보가 없습니다.'
      using errcode = '22023';
  end if;

  select *
    into v_member
  from new_axe_net.members m
  where m.member_key = p_member_key
    and m.status = 'active'
  limit 1;

  if not found then
    raise exception '활동 중인 멤버를 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  if v_member.discord_user_id is null
     or btrim(v_member.discord_user_id) <> btrim(p_discord_user_id) then
    raise exception '멤버와 Discord 계정연동 정보가 일치하지 않습니다.'
      using errcode = '42501';
  end if;

  v_period_end := new_axe_net.fund_period_end(
    p_year,
    p_month,
    p_week
  );

  if v_period_end is null then
    raise exception '존재하지 않는 공금 주차입니다.'
      using errcode = '22023';
  end if;

  v_period_start := v_period_end - 6;

  if v_period_start > v_today then
    raise exception '아직 시작하지 않은 주차에는 신청할 수 없습니다.'
      using errcode = '22023';
  end if;

  if v_member.joined_date > v_period_end then
    raise exception '가입 전 주차에는 신청할 수 없습니다.'
      using errcode = '22023';
  end if;

  if p_payment_mode not in ('공용계좌', '회사잔고', '분할납부') then
    raise exception '올바르지 않은 납부 방식입니다.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from new_axe_net.fund_exemptions e
    where e.member_key = p_member_key
      and e.year = p_year
      and e.month = p_month
      and e.week = p_week
      and e.enabled = true
  ) then
    raise exception '해당 주차는 면제 처리되어 있습니다.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from new_axe_net.fund_ledger l
    where l.member_key = p_member_key
      and l.year = p_year
      and l.month = p_month
      and l.week = p_week
      and l.entry_type = 'payment'
      and l.status = 'active'
  ) then
    raise exception '이미 해당 주차의 납부가 완료되었습니다.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from new_axe_net.fund_requests r
    where r.member_key = p_member_key
      and r.year = p_year
      and r.month = p_month
      and r.week = p_week
      and r.status in ('pending', 'hold')
  ) then
    raise exception '이미 검수대기 또는 보류 중인 신청이 있습니다.'
      using errcode = '23505';
  end if;

  v_amount := coalesce(
    p_amount,
    new_axe_net.fund_weekly_fee(
      p_year,
      p_month,
      p_week
    )
  );

  if v_amount is null or v_amount <= 0 then
    raise exception '납부 금액은 0원보다 커야 합니다.'
      using errcode = '22023';
  end if;

  if p_payment_mode = '공용계좌' then
    v_public := v_amount;
    v_company := 0;
  elsif p_payment_mode = '회사잔고' then
    v_public := 0;
    v_company := v_amount;
  else
    v_public := coalesce(p_public_amount, 0);
    v_company := coalesce(p_company_amount, 0);

    if v_public <= 0 or v_company <= 0 then
      raise exception '분할납부는 공용계좌와 회사잔고 금액을 모두 입력하세요.'
        using errcode = '22023';
    end if;

    if v_public + v_company <> v_amount then
      raise exception '분할납부 합계가 총 납부금액과 일치하지 않습니다.'
        using errcode = '22023';
    end if;
  end if;

  if nullif(btrim(p_evidence_url), '') is null then
    raise exception '증빙 스크린샷을 첨부하세요.'
      using errcode = '22023';
  end if;

  v_source_key := new_axe_net.new_fund_operation_key(
    'web_fund_request_v2'
  );

  insert into new_axe_net.fund_requests (
    legacy_id,
    guild_id,
    discord_user_id,
    discord_name,
    member_key,
    nickname,
    year,
    month,
    week,
    amount,
    status,
    evidence_url,
    memo,
    reviewer_discord_name,
    reviewed_at,
    source_key,
    payment_mode,
    public_amount,
    company_amount,
    client_request_id,
    sheet_request_id,
    submitted_via,
    submitted_by_name,
    proxy_admin_name
  )
  values (
    null,
    null,
    btrim(p_discord_user_id),
    v_member.discord_name,
    p_member_key,
    v_member.nickname,
    p_year,
    p_month,
    p_week,
    v_amount,
    'pending',
    btrim(p_evidence_url),
    nullif(btrim(p_memo), ''),
    null,
    null,
    v_source_key,
    p_payment_mode,
    v_public,
    v_company,
    v_source_key,
    null,
    coalesce(nullif(btrim(p_submitted_via), ''), 'web'),
    coalesce(nullif(btrim(p_submitted_by_name), ''), v_member.nickname),
    nullif(btrim(p_proxy_admin_name), '')
  )
  returning id into v_id;

  insert into new_axe_net.fund_admin_audit_log (
    action,
    target_type,
    target_key,
    actor_user_id,
    actor_nickname,
    payload
  )
  values (
    'submit_request_v2',
    'fund_request',
    v_id::text,
    auth.uid(),
    coalesce(
      nullif(btrim(p_proxy_admin_name), ''),
      nullif(btrim(p_submitted_by_name), ''),
      v_member.nickname
    ),
    jsonb_build_object(
      'member_key', p_member_key,
      'nickname', v_member.nickname,
      'year', p_year,
      'month', p_month,
      'week', p_week,
      'amount', v_amount,
      'payment_mode', p_payment_mode,
      'public_amount', v_public,
      'company_amount', v_company,
      'evidence_url', btrim(p_evidence_url),
      'submitted_by_name', coalesce(nullif(btrim(p_submitted_by_name), ''), v_member.nickname),
      'proxy_admin_name', nullif(btrim(p_proxy_admin_name), ''),
      'submitted_via', coalesce(nullif(btrim(p_submitted_via), ''), 'web')
    )
  );

  return v_id;
end;
$$;

-- =========================================================
-- 4) 검수 승인 / 보류 / 반려 / 일괄승인
-- =========================================================

create or replace function new_axe_net.approve_fund_request(
  p_request_id bigint,
  p_review_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request new_axe_net.fund_requests%rowtype;
  v_actor text;
  v_ledger_id bigint;
  v_operation_key text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  select *
    into v_request
  from new_axe_net.fund_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception '신청을 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  if v_request.status not in ('pending', 'hold') then
    raise exception '이미 처리된 신청입니다.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from new_axe_net.fund_ledger l
    where l.member_key = v_request.member_key
      and l.year = v_request.year
      and l.month = v_request.month
      and l.week = v_request.week
      and l.entry_type = 'payment'
      and l.status = 'active'
  ) then
    raise exception '이미 해당 주차에 활성 납부 기록이 있습니다.'
      using errcode = '23505';
  end if;

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  v_operation_key := new_axe_net.new_fund_operation_key(
    'approved_request'
  );

  insert into new_axe_net.fund_ledger (
    legacy_id,
    member_key,
    nickname,
    year,
    month,
    week,
    entry_type,
    amount,
    public_amount,
    company_amount,
    status,
    approved_by_name,
    approved_at,
    legacy_request_key,
    source_key,
    memo,
    ledger_date,
    ledger_type,
    category,
    direction,
    account,
    evidence_url,
    operation_key,
    request_id
  )
  values (
    null,
    v_request.member_key,
    v_request.nickname,
    v_request.year,
    v_request.month,
    v_request.week,
    'payment',
    v_request.amount,
    v_request.public_amount,
    v_request.company_amount,
    'active',
    v_actor,
    now(),
    'new_request:' || v_request.id::text,
    v_operation_key,
    concat_ws(
      ' · ',
      case
        when v_request.proxy_admin_name is not null
          then '[관리자 대리제출: ' || v_request.proxy_admin_name || ']'
        else null
      end,
      nullif(v_request.memo, '')
    ),
    (
      ((now() at time zone 'Asia/Seoul')::date)::timestamp
      + interval '12 hours'
    ) at time zone 'Asia/Seoul',
    '공금납부',
    '주간공금',
    '수입',
    coalesce(v_request.payment_mode, '공용계좌'),
    v_request.evidence_url,
    v_operation_key,
    v_request.id
  )
  returning id into v_ledger_id;

  update new_axe_net.fund_requests
  set
    status = 'approved',
    reviewer_discord_name = v_actor,
    reviewed_at = now(),
    review_note = nullif(btrim(p_review_note), '')
  where id = p_request_id;

  insert into new_axe_net.fund_admin_audit_log (
    action,
    target_type,
    target_key,
    actor_user_id,
    actor_nickname,
    payload
  )
  values (
    'approve_request',
    'fund_request',
    p_request_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'ledger_id', v_ledger_id,
      'member_key', v_request.member_key,
      'nickname', v_request.nickname,
      'year', v_request.year,
      'month', v_request.month,
      'week', v_request.week,
      'amount', v_request.amount,
      'payment_mode', v_request.payment_mode,
      'public_amount', v_request.public_amount,
      'company_amount', v_request.company_amount,
      'evidence_url', v_request.evidence_url,
      'review_note', nullif(btrim(p_review_note), '')
    )
  );

  return v_ledger_id;
end;
$$;

create or replace function new_axe_net.hold_fund_request(
  p_request_id bigint,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request new_axe_net.fund_requests%rowtype;
  v_actor text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  select *
    into v_request
  from new_axe_net.fund_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception '신청을 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  if v_request.status not in ('pending', 'hold') then
    raise exception '이미 처리된 신청입니다.'
      using errcode = '22023';
  end if;

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  update new_axe_net.fund_requests
  set
    status = 'hold',
    reviewer_discord_name = v_actor,
    reviewed_at = now(),
    review_note = nullif(btrim(p_review_note), '')
  where id = p_request_id;

  insert into new_axe_net.fund_admin_audit_log (
    action,
    target_type,
    target_key,
    actor_user_id,
    actor_nickname,
    payload
  )
  values (
    'hold_request',
    'fund_request',
    p_request_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'member_key', v_request.member_key,
      'nickname', v_request.nickname,
      'year', v_request.year,
      'month', v_request.month,
      'week', v_request.week,
      'amount', v_request.amount,
      'payment_mode', v_request.payment_mode,
      'review_note', nullif(btrim(p_review_note), '')
    )
  );
end;
$$;

create or replace function new_axe_net.reject_fund_request(
  p_request_id bigint,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request new_axe_net.fund_requests%rowtype;
  v_actor text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  select *
    into v_request
  from new_axe_net.fund_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception '신청을 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  if v_request.status not in ('pending', 'hold') then
    raise exception '이미 처리된 신청입니다.'
      using errcode = '22023';
  end if;

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  update new_axe_net.fund_requests
  set
    status = 'rejected',
    reviewer_discord_name = v_actor,
    reviewed_at = now(),
    review_note = nullif(btrim(p_review_note), '')
  where id = p_request_id;

  insert into new_axe_net.fund_admin_audit_log (
    action,
    target_type,
    target_key,
    actor_user_id,
    actor_nickname,
    payload
  )
  values (
    'reject_request',
    'fund_request',
    p_request_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'member_key', v_request.member_key,
      'nickname', v_request.nickname,
      'year', v_request.year,
      'month', v_request.month,
      'week', v_request.week,
      'amount', v_request.amount,
      'payment_mode', v_request.payment_mode,
      'review_note', nullif(btrim(p_review_note), '')
    )
  );
end;
$$;

create or replace function new_axe_net.approve_fund_requests_bulk(
  p_request_ids bigint[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id bigint;
  v_count integer := 0;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  if p_request_ids is null or cardinality(p_request_ids) = 0 then
    raise exception '일괄승인할 신청을 선택해주세요.'
      using errcode = '22023';
  end if;

  for v_request_id in
    select distinct x.request_id
    from unnest(p_request_ids) as x(request_id)
    where x.request_id is not null
    order by x.request_id
  loop
    perform new_axe_net.approve_fund_request(v_request_id, null);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception '일괄승인할 신청을 선택해주세요.'
      using errcode = '22023';
  end if;

  return v_count;
end;
$$;

-- =========================================================
-- 5) 월별현황 집계에서 hold를 검수대기로 반영
-- =========================================================

create or replace function new_axe_net.get_fund_month_overview(
  p_year integer,
  p_month integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_weeks jsonb := '[]'::jsonb;
  v_completed bigint := 0;
  v_unpaid bigint := 0;
  v_exempt bigint := 0;
  v_scheduled bigint := 0;
  v_before_join bigint := 0;
  v_pending bigint := 0;
begin
  if p_month < 1 or p_month > 12 then
    raise exception '월은 1~12 사이여야 합니다.'
      using errcode = '22023';
  end if;

  with saturdays as (
    select
      d::date as period_end,
      row_number() over (order by d)::integer as week
    from generate_series(
      make_date(p_year, p_month, 1)::timestamp,
      (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::timestamp,
      interval '1 day'
    ) d
    where extract(dow from d) = 6
  ),
  rows as (
    select
      s.week,
      s.period_end,
      new_axe_net.fund_weekly_fee(p_year, p_month, s.week) as weekly_fee,
      count(*) filter (where f.status = '완료')::bigint as completed_count,
      count(*) filter (where f.status = '미납')::bigint as unpaid_count,
      count(*) filter (where f.status = '면제')::bigint as exempt_count,
      count(*) filter (where f.status = '예정')::bigint as scheduled_count,
      count(*) filter (where f.status = '가입 전')::bigint as before_join_count,
      (
        select count(*)::bigint
        from new_axe_net.fund_requests r
        where r.year = p_year
          and r.month = p_month
          and r.week = s.week
          and r.status in ('pending', 'hold')
      ) as pending_count
    from saturdays s
    cross join lateral new_axe_net.fund_period_status_live(
      p_year,
      p_month,
      s.week
    ) f
    group by s.week, s.period_end
    order by s.week
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'year', p_year,
          'month', p_month,
          'week', week,
          'period_end', period_end,
          'weekly_fee', weekly_fee,
          'completed', completed_count,
          'unpaid', unpaid_count,
          'exempt', exempt_count,
          'scheduled', scheduled_count,
          'before_join', before_join_count,
          'pending', pending_count
        )
        order by week
      ),
      '[]'::jsonb
    ),
    coalesce(sum(completed_count), 0),
    coalesce(sum(unpaid_count), 0),
    coalesce(sum(exempt_count), 0),
    coalesce(sum(scheduled_count), 0),
    coalesce(sum(before_join_count), 0),
    coalesce(sum(pending_count), 0)
  into
    v_weeks,
    v_completed,
    v_unpaid,
    v_exempt,
    v_scheduled,
    v_before_join,
    v_pending
  from rows;

  return jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'weeks', v_weeks,
    'totals', jsonb_build_object(
      'completed', v_completed,
      'unpaid', v_unpaid,
      'exempt', v_exempt,
      'scheduled', v_scheduled,
      'before_join', v_before_join,
      'pending', v_pending
    )
  );
end;
$$;

-- =========================================================
-- 6) 월별 매트릭스에서 hold를 검수대기로 반영
-- =========================================================

create or replace function new_axe_net.get_fund_month_matrix(
  p_year integer,
  p_month integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_weeks jsonb := '[]'::jsonb;
  v_members jsonb := '[]'::jsonb;
begin
  if p_month < 1 or p_month > 12 then
    raise exception '월은 1~12 사이여야 합니다.'
      using errcode = '22023';
  end if;

  with saturdays as (
    select
      d::date as period_end,
      (d::date - 6) as period_start,
      row_number() over (order by d)::integer as week
    from generate_series(
      make_date(p_year, p_month, 1)::timestamp,
      (
        make_date(p_year, p_month, 1)
        + interval '1 month - 1 day'
      )::timestamp,
      interval '1 day'
    ) d
    where extract(dow from d) = 6
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'year', p_year,
        'month', p_month,
        'week', s.week,
        'period_start', s.period_start,
        'period_end', s.period_end,
        'weekly_fee', new_axe_net.fund_weekly_fee(
          p_year,
          p_month,
          s.week
        )
      )
      order by s.week
    ),
    '[]'::jsonb
  )
  into v_weeks
  from saturdays s;

  with saturdays as (
    select
      d::date as period_end,
      (d::date - 6) as period_start,
      row_number() over (order by d)::integer as week
    from generate_series(
      make_date(p_year, p_month, 1)::timestamp,
      (
        make_date(p_year, p_month, 1)
        + interval '1 month - 1 day'
      )::timestamp,
      interval '1 day'
    ) d
    where extract(dow from d) = 6
  ),
  rows as (
    select
      f.member_key,
      f.sort_order,
      f.nickname,
      f.join_date,
      s.week,
      s.period_start,
      s.period_end,
      f.amount,
      new_axe_net.fund_weekly_fee(
        p_year,
        p_month,
        s.week
      ) as weekly_fee,
      case
        when exists (
          select 1
          from new_axe_net.fund_requests r
          where r.member_key = f.member_key
            and r.year = p_year
            and r.month = p_month
            and r.week = s.week
            and r.status in ('pending', 'hold')
        ) then '검수대기'
        else f.status
      end as display_status,
      payment.account as payment_account
    from saturdays s
    cross join lateral new_axe_net.fund_period_status_live(
      p_year,
      p_month,
      s.week
    ) f
    left join lateral (
      select l.account
      from new_axe_net.fund_ledger l
      where l.member_key = f.member_key
        and l.year = p_year
        and l.month = p_month
        and l.week = s.week
        and l.entry_type = 'payment'
        and l.status = 'active'
      order by l.ledger_date desc, l.id desc
      limit 1
    ) payment on true
  ),
  member_rows as (
    select
      r.member_key,
      min(r.sort_order)::integer as sort_order,
      max(r.nickname) as nickname,
      max(r.join_date) as join_date,
      count(*) filter (
        where r.display_status = '미납'
      )::integer as unpaid_count,
      count(*) filter (
        where r.display_status = '검수대기'
      )::integer as pending_count,
      jsonb_agg(
        jsonb_build_object(
          'week', r.week,
          'period_start', r.period_start,
          'period_end', r.period_end,
          'status', r.display_status,
          'amount', r.amount,
          'weekly_fee', r.weekly_fee,
          'payment_account', r.payment_account
        )
        order by r.week
      ) as cells
    from rows r
    group by r.member_key
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'member_key', m.member_key,
        'sort_order', m.sort_order,
        'nickname', m.nickname,
        'join_date', m.join_date,
        'unpaid_count', m.unpaid_count,
        'pending_count', m.pending_count,
        'cells', m.cells
      )
      order by m.sort_order, m.nickname
    ),
    '[]'::jsonb
  )
  into v_members
  from member_rows m;

  return jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'weeks', v_weeks,
    'members', v_members
  );
end;
$$;

-- =========================================================
-- 7) 정합성점검에서 hold도 처리 중 신청으로 반영
-- =========================================================

create or replace function new_axe_net.get_fund_integrity_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duplicates jsonb := '[]'::jsonb;
  v_approved_missing jsonb := '[]'::jsonb;
  v_pending_with_payment jsonb := '[]'::jsonb;
  v_orphan_ledgers jsonb := '[]'::jsonb;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  into v_duplicates
  from (
    select
      min(l.nickname) as nickname,
      l.member_key,
      l.year,
      l.month,
      l.week,
      count(*)::integer as active_count,
      array_agg(l.id order by l.id) as ledger_ids
    from new_axe_net.fund_ledger l
    where l.entry_type = 'payment'
      and l.status = 'active'
    group by l.member_key, l.year, l.month, l.week
    having count(*) > 1
    order by l.year desc, l.month desc, l.week desc
  ) x;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  into v_approved_missing
  from (
    select
      r.id as request_id,
      r.member_key,
      r.nickname,
      r.year,
      r.month,
      r.week,
      r.amount
    from new_axe_net.fund_requests r
    where r.status = 'approved'
      and not exists (
        select 1
        from new_axe_net.fund_ledger l
        where l.status = 'active'
          and l.entry_type = 'payment'
          and (
            l.request_id = r.id
            or (
              l.member_key = r.member_key
              and l.year = r.year
              and l.month = r.month
              and l.week = r.week
            )
          )
      )
    order by r.created_at desc
    limit 100
  ) x;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  into v_pending_with_payment
  from (
    select
      r.id as request_id,
      r.member_key,
      r.nickname,
      r.year,
      r.month,
      r.week,
      r.amount
    from new_axe_net.fund_requests r
    where r.status in ('pending', 'hold')
      and exists (
        select 1
        from new_axe_net.fund_ledger l
        where l.status = 'active'
          and l.entry_type = 'payment'
          and l.member_key = r.member_key
          and l.year = r.year
          and l.month = r.month
          and l.week = r.week
      )
    order by r.created_at desc
    limit 100
  ) x;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  into v_orphan_ledgers
  from (
    select
      l.id as ledger_id,
      l.request_id,
      l.member_key,
      l.nickname,
      l.year,
      l.month,
      l.week,
      l.amount
    from new_axe_net.fund_ledger l
    where l.status = 'active'
      and l.entry_type = 'payment'
      and l.request_id is not null
      and not exists (
        select 1
        from new_axe_net.fund_requests r
        where r.id = l.request_id
      )
    order by l.ledger_date desc
    limit 100
  ) x;

  return jsonb_build_object(
    'generated_at', now(),
    'counts', jsonb_build_object(
      'duplicates', jsonb_array_length(v_duplicates),
      'approved_missing', jsonb_array_length(v_approved_missing),
      'pending_with_payment', jsonb_array_length(v_pending_with_payment),
      'orphan_ledgers', jsonb_array_length(v_orphan_ledgers),
      'total',
        jsonb_array_length(v_duplicates)
        + jsonb_array_length(v_approved_missing)
        + jsonb_array_length(v_pending_with_payment)
        + jsonb_array_length(v_orphan_ledgers)
    ),
    'duplicates', v_duplicates,
    'approved_missing', v_approved_missing,
    'pending_with_payment', v_pending_with_payment,
    'orphan_ledgers', v_orphan_ledgers
  );
end;
$$;

-- =========================================================
-- 8) 권한
-- =========================================================

revoke all on function new_axe_net.hold_fund_request(bigint, text)
from public, anon;
grant execute on function new_axe_net.hold_fund_request(bigint, text)
to authenticated;

revoke all on function new_axe_net.approve_fund_requests_bulk(bigint[])
from public, anon;
grant execute on function new_axe_net.approve_fund_requests_bulk(bigint[])
to authenticated;

revoke all on function new_axe_net.submit_fund_request_v2(
  text, text, integer, integer, integer, integer, text, integer, integer,
  text, text, text, text, text
) from public, anon;
grant execute on function new_axe_net.submit_fund_request_v2(
  text, text, integer, integer, integer, integer, text, integer, integer,
  text, text, text, text, text
) to authenticated, service_role;

revoke all on function new_axe_net.approve_fund_request(bigint, text)
from public, anon;
grant execute on function new_axe_net.approve_fund_request(bigint, text)
to authenticated;

revoke all on function new_axe_net.reject_fund_request(bigint, text)
from public, anon;
grant execute on function new_axe_net.reject_fund_request(bigint, text)
to authenticated;

revoke all on function new_axe_net.get_fund_month_overview(integer, integer)
from public;
grant execute on function new_axe_net.get_fund_month_overview(integer, integer)
to anon, authenticated;

revoke all on function new_axe_net.get_fund_month_matrix(integer, integer)
from public;
grant execute on function new_axe_net.get_fund_month_matrix(integer, integer)
to anon, authenticated;

revoke all on function new_axe_net.get_fund_integrity_report()
from public, anon;
grant execute on function new_axe_net.get_fund_integrity_report()
to authenticated;

notify pgrst, 'reload schema';
