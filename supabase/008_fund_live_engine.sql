-- AXE NET v1.0
-- 008_fund_live_engine.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행
--
-- 핵심 전환:
-- fund_status_snapshot을 화면 계산 원본에서 제외합니다.
-- 이제 주간 공금 상태는 아래 4개만으로 실시간 계산합니다.
--
-- 1) new_axe_net.members
-- 2) new_axe_net.fund_fee_rules
-- 3) new_axe_net.fund_exemptions
-- 4) new_axe_net.fund_ledger
--
-- 주차 규칙:
-- 각 월의 토요일을 1주차, 2주차 ... 로 계산합니다.
-- 한 주는 해당 토요일을 끝으로 하는 일요일~토요일 구간입니다.

create or replace function new_axe_net.fund_period_end(
  p_year integer,
  p_month integer,
  p_week integer
)
returns date
language sql
immutable
security definer
set search_path = ''
as $$
  select d::date
  from generate_series(
    make_date(p_year, p_month, 1)::timestamp,
    (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::timestamp,
    interval '1 day'
  ) d
  where extract(dow from d) = 6
  order by d
  offset greatest(p_week - 1, 0)
  limit 1;
$$;

create or replace function new_axe_net.fund_weekly_fee(
  p_year integer,
  p_month integer,
  p_week integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select r.weekly_fee
    from new_axe_net.fund_fee_rules r
    where r.enabled = true
      and (r.start_year, r.start_month, r.start_week)
        <= (p_year, p_month, p_week)
    order by
      r.start_year desc,
      r.start_month desc,
      r.start_week desc,
      r.id desc
    limit 1
  ), 0);
$$;

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
  )
  select
    m.member_key,
    m.sort_order,
    m.nickname,
    case
      when p.period_end is null then '가입 전'
      when p.period_start > p.today_kst then '예정'
      when m.joined_date > p.period_end then '가입 전'
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
      when m.joined_date > p.period_end then 0
      else p.weekly_fee
    end::integer as amount,
    m.joined_date as join_date
  from new_axe_net.members m
  cross join params p
  where m.status = 'active'
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
        date_trunc('month', min(m.joined_date))::date,
        date_trunc('month', (now() at time zone 'Asia/Seoul')::date)::date
      ) as start_date,
      (now() at time zone 'Asia/Seoul')::date as today_kst
    from new_axe_net.members m
    where m.status = 'active'
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

create or replace function new_axe_net.get_fund_summary(
  p_year integer default null,
  p_month integer default null,
  p_week integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_year integer;
  v_month integer;
  v_week integer;
  v_fee integer := 0;

  v_member_count bigint := 0;
  v_completed bigint := 0;
  v_unpaid bigint := 0;
  v_exempt bigint := 0;
  v_scheduled bigint := 0;
  v_before_join bigint := 0;

  v_expected bigint := 0;
  v_paid bigint := 0;
  v_unpaid_amount bigint := 0;
  v_exempt_amount bigint := 0;

  v_public_balance bigint := 0;
  v_company_balance bigint := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_year is null or p_month is null or p_week is null then
    select
      p.year,
      p.month,
      p.week
    into
      v_year,
      v_month,
      v_week
    from new_axe_net.get_fund_periods() p
    where new_axe_net.fund_period_end(p.year, p.month, p.week) - 6 <= v_today
    order by
      new_axe_net.fund_period_end(p.year, p.month, p.week) desc
    limit 1;
  else
    v_year := p_year;
    v_month := p_month;
    v_week := p_week;
  end if;

  if v_year is null then
    return jsonb_build_object(
      'period', null,
      'balance', jsonb_build_object(
        'total', 0,
        'public', 0,
        'company', 0
      ),
      'fee', 0,
      'counts', jsonb_build_object(),
      'amounts', jsonb_build_object(),
      'engine', 'live'
    );
  end if;

  v_fee := new_axe_net.fund_weekly_fee(v_year, v_month, v_week);

  select
    count(*),
    count(*) filter (where s.status = '완료'),
    count(*) filter (where s.status = '미납'),
    count(*) filter (where s.status = '면제'),
    count(*) filter (where s.status = '예정'),
    count(*) filter (where s.status = '가입 전'),
    coalesce(sum(s.amount) filter (where s.status in ('완료', '미납')), 0),
    coalesce(sum(s.amount) filter (where s.status = '완료'), 0),
    coalesce(sum(s.amount) filter (where s.status = '미납'), 0),
    coalesce(sum(s.amount) filter (where s.status = '면제'), 0)
  into
    v_member_count,
    v_completed,
    v_unpaid,
    v_exempt,
    v_scheduled,
    v_before_join,
    v_expected,
    v_paid,
    v_unpaid_amount,
    v_exempt_amount
  from new_axe_net.fund_period_status_live(v_year, v_month, v_week) s;

  select
    coalesce(sum(
      case l.direction
        when '수입' then l.public_amount
        when '지출' then -l.public_amount
        when '조정' then l.public_amount
        else 0
      end
    ), 0),
    coalesce(sum(
      case l.direction
        when '수입' then l.company_amount
        when '지출' then -l.company_amount
        when '조정' then l.company_amount
        else 0
      end
    ), 0)
  into
    v_public_balance,
    v_company_balance
  from new_axe_net.fund_ledger l
  where l.status = 'active';

  return jsonb_build_object(
    'period', jsonb_build_object(
      'year', v_year,
      'month', v_month,
      'week', v_week
    ),
    'balance', jsonb_build_object(
      'total', v_public_balance + v_company_balance,
      'public', v_public_balance,
      'company', v_company_balance
    ),
    'fee', coalesce(v_fee, 0),
    'counts', jsonb_build_object(
      'members', v_member_count,
      'completed', v_completed,
      'unpaid', v_unpaid,
      'exempt', v_exempt,
      'scheduled', v_scheduled,
      'before_join', v_before_join
    ),
    'amounts', jsonb_build_object(
      'expected', v_expected,
      'paid', v_paid,
      'unpaid', v_unpaid_amount,
      'exempt', v_exempt_amount
    ),
    'engine', 'live'
  );
end;
$$;

create or replace function new_axe_net.get_fund_period_status(
  p_year integer,
  p_month integer,
  p_week integer
)
returns table (
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
  select
    s.sort_order,
    s.nickname,
    s.status,
    s.amount,
    s.join_date
  from new_axe_net.fund_period_status_live(
    p_year,
    p_month,
    p_week
  ) s
  order by s.sort_order;
$$;

revoke all on function new_axe_net.fund_period_end(integer, integer, integer) from public;
revoke all on function new_axe_net.fund_weekly_fee(integer, integer, integer) from public;
revoke all on function new_axe_net.fund_period_status_live(integer, integer, integer) from public;
revoke all on function new_axe_net.get_fund_periods() from public;
revoke all on function new_axe_net.get_fund_summary(integer, integer, integer) from public;
revoke all on function new_axe_net.get_fund_period_status(integer, integer, integer) from public;

grant execute on function new_axe_net.get_fund_periods()
to anon, authenticated;

grant execute on function new_axe_net.get_fund_summary(integer, integer, integer)
to anon, authenticated;

grant execute on function new_axe_net.get_fund_period_status(integer, integer, integer)
to anon, authenticated;

grant usage on schema new_axe_net to anon, authenticated;

notify pgrst, 'reload schema';
