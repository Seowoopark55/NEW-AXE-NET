-- AXE NET v1.13.0
-- 018_fund_admin_parity.sql
-- 기존 AXE NET 공금 관리자 기능 패리티 2차
-- - 공금대상 멤버 설정(활성/제외, 가입일 보정, 메모)
-- - 공금내역 직접등록 증빙
-- - 잔액점검 증빙
-- - DB 기반 정합성점검

-- =========================================================
-- 1) 공금 대상 멤버 설정
-- =========================================================

create table if not exists new_axe_net.fund_member_settings (
  member_key text primary key
    references new_axe_net.members(member_key)
    on update cascade
    on delete cascade,
  enabled boolean not null default true,
  join_date_override date,
  note text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into new_axe_net.fund_member_settings (member_key, enabled)
select m.member_key, true
from new_axe_net.members m
on conflict (member_key) do nothing;

drop trigger if exists fund_member_settings_touch_updated_at
on new_axe_net.fund_member_settings;

create trigger fund_member_settings_touch_updated_at
before update on new_axe_net.fund_member_settings
for each row
execute function new_axe_net.touch_updated_at();

alter table new_axe_net.fund_member_settings enable row level security;

revoke all on table new_axe_net.fund_member_settings
from public, anon, authenticated;

grant select on table new_axe_net.fund_member_settings
to authenticated;

drop policy if exists "fund_member_settings_admin_read"
on new_axe_net.fund_member_settings;

create policy "fund_member_settings_admin_read"
on new_axe_net.fund_member_settings
for select
to authenticated
using (new_axe_net.is_admin());

create or replace function new_axe_net.set_fund_member_setting(
  p_member_key text,
  p_enabled boolean,
  p_join_date_override date default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from new_axe_net.members m
    where m.member_key = p_member_key
  ) then
    raise exception '멤버를 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');

  insert into new_axe_net.fund_member_settings (
    member_key,
    enabled,
    join_date_override,
    note,
    updated_by
  )
  values (
    p_member_key,
    coalesce(p_enabled, true),
    p_join_date_override,
    nullif(btrim(p_note), ''),
    v_actor
  )
  on conflict (member_key) do update
  set
    enabled = excluded.enabled,
    join_date_override = excluded.join_date_override,
    note = excluded.note,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into new_axe_net.fund_admin_audit_log (
    action,
    target_type,
    target_key,
    actor_user_id,
    actor_nickname,
    payload
  )
  values (
    'set_fund_member',
    'fund_member',
    p_member_key,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'enabled', coalesce(p_enabled, true),
      'join_date_override', p_join_date_override,
      'note', nullif(btrim(p_note), '')
    )
  );
end;
$$;

revoke all on function new_axe_net.set_fund_member_setting(
  text, boolean, date, text
) from public, anon;

grant execute on function new_axe_net.set_fund_member_setting(
  text, boolean, date, text
) to authenticated;

-- =========================================================
-- 2) LIVE ENGINE: 공금대상 설정/가입일 보정 반영
-- =========================================================

create or replace function new_axe_net.fund_period_status_live(
  p_year integer,
  p_month integer,
  p_week integer
)
returns table (
  member_key text,
  sort_order integer,
  nickname text,
  status text,
  amount integer,
  join_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  with period as (
    select
      new_axe_net.fund_period_end(p_year, p_month, p_week) as period_end,
      new_axe_net.fund_weekly_fee(p_year, p_month, p_week) as weekly_fee,
      (now() at time zone 'Asia/Seoul')::date as today_kst
  ),
  params as (
    select
      period_end,
      period_end - 6 as period_start,
      weekly_fee,
      today_kst
    from period
  ),
  eligible_members as (
    select
      m.member_key,
      m.sort_order,
      m.nickname,
      coalesce(fs.join_date_override, m.joined_date) as effective_join_date
    from new_axe_net.members m
    left join new_axe_net.fund_member_settings fs
      on fs.member_key = m.member_key
    where m.status = 'active'
      and coalesce(fs.enabled, true) = true
  )
  select
    m.member_key,
    m.sort_order,
    m.nickname,
    case
      when p.period_end is null then '가입 전'
      when p.period_start > p.today_kst then '예정'
      when m.effective_join_date is not null
           and m.effective_join_date > p.period_end then '가입 전'
      when exists (
        select 1
        from new_axe_net.fund_exemptions e
        where e.member_key = m.member_key
          and e.year = p_year
          and e.month = p_month
          and e.week = p_week
          and e.enabled = true
      ) then '면제'
      when exists (
        select 1
        from new_axe_net.fund_ledger l
        where l.member_key = m.member_key
          and l.year = p_year
          and l.month = p_month
          and l.week = p_week
          and l.entry_type = 'payment'
          and l.status = 'active'
          and l.amount > 0
      ) then '완료'
      else '미납'
    end::text as status,
    case
      when p.period_end is null then 0
      when p.period_start > p.today_kst then 0
      when m.effective_join_date is not null
           and m.effective_join_date > p.period_end then 0
      else p.weekly_fee
    end::integer as amount,
    m.effective_join_date as join_date
  from eligible_members m
  cross join params p
  order by m.sort_order;
$$;

create or replace function new_axe_net.get_fund_periods()
returns table (
  year integer,
  month integer,
  week integer,
  member_count bigint,
  completed_count bigint,
  unpaid_count bigint,
  exempt_count bigint,
  scheduled_count bigint,
  before_join_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select
      coalesce(
        date_trunc(
          'month',
          min(coalesce(fs.join_date_override, m.joined_date))
        )::date,
        date_trunc(
          'month',
          (now() at time zone 'Asia/Seoul')::date
        )::date
      ) as start_date,
      (now() at time zone 'Asia/Seoul')::date as today_kst
    from new_axe_net.members m
    left join new_axe_net.fund_member_settings fs
      on fs.member_key = m.member_key
    where m.status = 'active'
      and coalesce(fs.enabled, true) = true
  ),
  bounds as (
    select
      start_date,
      today_kst,
      today_kst +
        case
          when extract(dow from today_kst) = 6 then 7
          else (6 - extract(dow from today_kst))::integer
        end as end_date
    from settings
  ),
  saturdays as (
    select
      d::date as period_end,
      extract(year from d)::integer as year,
      extract(month from d)::integer as month,
      row_number() over (
        partition by extract(year from d), extract(month from d)
        order by d
      )::integer as week
    from bounds b
    cross join lateral generate_series(
      b.start_date::timestamp,
      b.end_date::timestamp,
      interval '1 day'
    ) d
    where extract(dow from d) = 6
  )
  select
    s.year,
    s.month,
    s.week,
    count(*)::bigint as member_count,
    count(*) filter (where f.status = '완료')::bigint as completed_count,
    count(*) filter (where f.status = '미납')::bigint as unpaid_count,
    count(*) filter (where f.status = '면제')::bigint as exempt_count,
    count(*) filter (where f.status = '예정')::bigint as scheduled_count,
    count(*) filter (where f.status = '가입 전')::bigint as before_join_count
  from saturdays s
  cross join lateral new_axe_net.fund_period_status_live(
    s.year,
    s.month,
    s.week
  ) f
  group by s.period_end, s.year, s.month, s.week
  order by s.period_end desc;
$$;

-- =========================================================
-- 3) 공금내역 직접등록 증빙
-- =========================================================

create or replace function new_axe_net.create_fund_payment_v2(
  p_member_key text,
  p_year integer,
  p_month integer,
  p_week integer,
  p_amount integer default null,
  p_account text default '공용계좌',
  p_ledger_date date default null,
  p_memo text default null,
  p_evidence_url text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_nickname text;
  v_amount integer;
  v_actor text;
  v_operation_key text;
  v_ledger_date date;
  v_public_amount integer := 0;
  v_company_amount integer := 0;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  if new_axe_net.fund_period_end(p_year, p_month, p_week) is null then
    raise exception '존재하지 않는 공금 주차입니다.'
      using errcode = '22023';
  end if;

  if p_account not in ('공용계좌', '회사잔고') then
    raise exception '올바르지 않은 계좌입니다.'
      using errcode = '22023';
  end if;

  select m.nickname
    into v_nickname
  from new_axe_net.members m
  where m.member_key = p_member_key
  limit 1;

  if v_nickname is null then
    raise exception '멤버를 찾을 수 없습니다.'
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
    raise exception '이미 해당 주차에 활성 납부 기록이 있습니다.'
      using errcode = '23505';
  end if;

  v_amount := coalesce(
    p_amount,
    new_axe_net.fund_weekly_fee(p_year, p_month, p_week)
  );

  if v_amount is null or v_amount <= 0 then
    raise exception '납부 금액은 0원보다 커야 합니다.'
      using errcode = '22023';
  end if;

  v_ledger_date := coalesce(
    p_ledger_date,
    (now() at time zone 'Asia/Seoul')::date
  );

  if p_account = '공용계좌' then
    v_public_amount := v_amount;
  else
    v_company_amount := v_amount;
  end if;

  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');
  v_operation_key := new_axe_net.new_fund_operation_key('new_payment_v2');

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
    source_key,
    memo,
    ledger_date,
    ledger_type,
    category,
    direction,
    account,
    evidence_url,
    operation_key
  )
  values (
    null,
    p_member_key,
    v_nickname,
    p_year,
    p_month,
    p_week,
    'payment',
    v_amount,
    v_public_amount,
    v_company_amount,
    'active',
    v_actor,
    now(),
    v_operation_key,
    nullif(btrim(p_memo), ''),
    (v_ledger_date::timestamp + interval '12 hours') at time zone 'Asia/Seoul',
    '공금납부',
    '주간공금',
    '수입',
    p_account,
    nullif(btrim(p_evidence_url), ''),
    v_operation_key
  )
  returning id into v_id;

  insert into new_axe_net.fund_admin_audit_log (
    action, target_type, target_key,
    actor_user_id, actor_nickname, payload
  )
  values (
    'create_payment_v2',
    'fund_ledger',
    v_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'member_key', p_member_key,
      'nickname', v_nickname,
      'year', p_year,
      'month', p_month,
      'week', p_week,
      'amount', v_amount,
      'account', p_account,
      'ledger_date', v_ledger_date,
      'evidence_url', nullif(btrim(p_evidence_url), ''),
      'memo', nullif(btrim(p_memo), '')
    )
  );

  return v_id;
end;
$$;

create or replace function new_axe_net.create_fund_transaction_v2(
  p_direction text,
  p_account text,
  p_amount integer,
  p_category text,
  p_ledger_date date default null,
  p_member_key text default null,
  p_memo text default null,
  p_evidence_url text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_actor text;
  v_operation_key text;
  v_ledger_date date;
  v_nickname text;
  v_entry_type text;
  v_ledger_type text;
  v_public_amount integer := 0;
  v_company_amount integer := 0;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  if p_direction not in ('수입', '지출', '조정') then
    raise exception '올바르지 않은 거래 방향입니다.'
      using errcode = '22023';
  end if;

  if p_account not in ('공용계좌', '회사잔고') then
    raise exception '올바르지 않은 계좌입니다.'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_category), '') is null then
    raise exception '분류를 입력하세요.'
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount = 0 then
    raise exception '금액은 0원이 될 수 없습니다.'
      using errcode = '22023';
  end if;

  if p_direction in ('수입', '지출') and p_amount < 0 then
    raise exception '수입/지출 금액은 양수로 입력하세요.'
      using errcode = '22023';
  end if;

  if p_member_key is not null and nullif(btrim(p_member_key), '') is not null then
    select m.nickname
      into v_nickname
    from new_axe_net.members m
    where m.member_key = p_member_key
    limit 1;

    if v_nickname is null then
      raise exception '연결할 멤버를 찾을 수 없습니다.'
        using errcode = '22023';
    end if;
  else
    p_member_key := null;
    v_nickname := null;
  end if;

  v_entry_type := case p_direction
    when '수입' then 'income'
    when '지출' then 'expense'
    else 'adjustment'
  end;

  v_ledger_type := case p_direction
    when '수입' then '수입'
    when '지출' then '지출'
    else '조정'
  end;

  v_ledger_date := coalesce(
    p_ledger_date,
    (now() at time zone 'Asia/Seoul')::date
  );

  if p_account = '공용계좌' then
    v_public_amount := p_amount;
  else
    v_company_amount := p_amount;
  end if;

  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');
  v_operation_key := new_axe_net.new_fund_operation_key('new_transaction_v2');

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
    source_key,
    memo,
    ledger_date,
    ledger_type,
    category,
    direction,
    account,
    evidence_url,
    operation_key
  )
  values (
    null,
    p_member_key,
    v_nickname,
    extract(year from v_ledger_date)::integer,
    extract(month from v_ledger_date)::integer,
    null,
    v_entry_type,
    p_amount,
    v_public_amount,
    v_company_amount,
    'active',
    v_actor,
    now(),
    v_operation_key,
    nullif(btrim(p_memo), ''),
    (v_ledger_date::timestamp + interval '12 hours') at time zone 'Asia/Seoul',
    v_ledger_type,
    btrim(p_category),
    p_direction,
    p_account,
    nullif(btrim(p_evidence_url), ''),
    v_operation_key
  )
  returning id into v_id;

  insert into new_axe_net.fund_admin_audit_log (
    action, target_type, target_key,
    actor_user_id, actor_nickname, payload
  )
  values (
    'create_transaction_v2',
    'fund_ledger',
    v_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'direction', p_direction,
      'account', p_account,
      'amount', p_amount,
      'category', btrim(p_category),
      'member_key', p_member_key,
      'nickname', v_nickname,
      'ledger_date', v_ledger_date,
      'evidence_url', nullif(btrim(p_evidence_url), ''),
      'memo', nullif(btrim(p_memo), '')
    )
  );

  return v_id;
end;
$$;

revoke all on function new_axe_net.create_fund_payment_v2(
  text, integer, integer, integer, integer, text, date, text, text
) from public, anon;

grant execute on function new_axe_net.create_fund_payment_v2(
  text, integer, integer, integer, integer, text, date, text, text
) to authenticated;

revoke all on function new_axe_net.create_fund_transaction_v2(
  text, text, integer, text, date, text, text, text
) from public, anon;

grant execute on function new_axe_net.create_fund_transaction_v2(
  text, text, integer, text, date, text, text, text
) to authenticated;

-- =========================================================
-- 4) 잔액점검 증빙
-- =========================================================

alter table new_axe_net.fund_balance_checks
  add column if not exists evidence_url text;

create or replace function new_axe_net.create_fund_balance_check_v2(
  p_actual_public integer,
  p_actual_company integer,
  p_evidence_url text default null,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_public integer := 0;
  v_company integer := 0;
  v_actor text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  if p_actual_public is null or p_actual_company is null then
    raise exception '실제 잔액을 모두 입력하세요.'
      using errcode = '22023';
  end if;

  select
    coalesce(sum(
      case l.direction
        when '수입' then l.public_amount
        when '지출' then -l.public_amount
        when '조정' then l.public_amount
        else 0
      end
    ), 0)::integer,
    coalesce(sum(
      case l.direction
        when '수입' then l.company_amount
        when '지출' then -l.company_amount
        when '조정' then l.company_amount
        else 0
      end
    ), 0)::integer
  into v_public, v_company
  from new_axe_net.fund_ledger l
  where l.status = 'active';

  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');

  insert into new_axe_net.fund_balance_checks (
    computed_public,
    computed_company,
    actual_public,
    actual_company,
    difference_public,
    difference_company,
    checked_by_user_id,
    checked_by_name,
    evidence_url,
    note
  )
  values (
    v_public,
    v_company,
    p_actual_public,
    p_actual_company,
    p_actual_public - v_public,
    p_actual_company - v_company,
    auth.uid(),
    v_actor,
    nullif(btrim(p_evidence_url), ''),
    nullif(btrim(p_note), '')
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
    'balance_check_v2',
    'fund_balance_check',
    v_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'computed_public', v_public,
      'computed_company', v_company,
      'actual_public', p_actual_public,
      'actual_company', p_actual_company,
      'difference_public', p_actual_public - v_public,
      'difference_company', p_actual_company - v_company,
      'evidence_url', nullif(btrim(p_evidence_url), ''),
      'note', nullif(btrim(p_note), '')
    )
  );

  return v_id;
end;
$$;

revoke all on function new_axe_net.create_fund_balance_check_v2(
  integer, integer, text, text
) from public, anon;

grant execute on function new_axe_net.create_fund_balance_check_v2(
  integer, integer, text, text
) to authenticated;

-- =========================================================
-- 5) DB 기반 정합성점검
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
    where r.status = 'pending'
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

revoke all on function new_axe_net.get_fund_integrity_report()
from public, anon;

grant execute on function new_axe_net.get_fund_integrity_report()
to authenticated;

notify pgrst, 'reload schema';
