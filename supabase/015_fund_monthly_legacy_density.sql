-- AXE NET v1.8
-- 015_fund_monthly_legacy_density.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행
--
-- 월별현황을 기존 AXE NET 방식에 더 가깝게 표시하기 위해
-- 완료 납부 셀의 계좌(공용계좌 / 회사잔고)를 함께 반환합니다.
--
-- 추가 CSV Import 없음.

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
            and r.status = 'pending'
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

revoke all on function new_axe_net.get_fund_month_matrix(
  integer,
  integer
) from public;

grant execute on function new_axe_net.get_fund_month_matrix(
  integer,
  integer
) to anon, authenticated;

notify pgrst, 'reload schema';
