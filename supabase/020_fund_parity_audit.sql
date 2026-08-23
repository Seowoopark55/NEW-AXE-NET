-- NEW AXE NET v1.22.0
-- 020_fund_parity_audit.sql
-- AXE NET -> NEW AXE NET 공금 기능 패리티 감사 보강
--
-- 적용 내용
-- 1) 월별현황 상태 판정: 부족 / 검수대기 / 반려 복원
-- 2) 미납 집계에 부족 / 반려 포함
-- 3) 멤버 공금 기준일 보정(join_date_override)을 내 제출 프로필에도 일관 적용
-- 4) 정합성점검: 승인신청-원장 금액 불일치 진단 추가
-- 5) 안전 복구 RPC: 승인 원장 누락 복구 / 신청<-원장 / 원장<-신청 금액 정렬
--
-- 전제: 001 ~ 019 마이그레이션 적용 완료

-- =========================================================
-- 1) LIVE STATUS: AXE NET 상태 우선순위 복원
--    가입 전/예정 -> 면제 -> 납부(완료/부족) -> 검수대기 -> 반려 -> 미납
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
      coalesce(weekly_fee, 0)::integer as weekly_fee,
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
      when pay.paid_total > 0
           and p.weekly_fee > 0
           and pay.paid_total < p.weekly_fee then '부족'
      when pay.paid_total > 0 then '완료'
      when exists (
        select 1
        from new_axe_net.fund_requests r
        where r.member_key = m.member_key
          and r.year = p_year
          and r.month = p_month
          and r.week = p_week
          and r.status in ('pending', 'hold')
      ) then '검수대기'
      when exists (
        select 1
        from new_axe_net.fund_requests r
        where r.member_key = m.member_key
          and r.year = p_year
          and r.month = p_month
          and r.week = p_week
          and r.status = 'rejected'
      ) then '반려'
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
  left join lateral (
    select coalesce(sum(abs(l.amount)), 0)::integer as paid_total
    from new_axe_net.fund_ledger l
    where l.member_key = m.member_key
      and l.year = p_year
      and l.month = p_month
      and l.week = p_week
      and l.entry_type = 'payment'
      and l.status = 'active'
  ) pay on true
  order by m.sort_order;
$$;

-- =========================================================
-- 2) 기간 목록 집계: 부족/반려도 미납으로 집계
-- =========================================================

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
    count(*) filter (where f.status in ('미납', '부족', '반려'))::bigint as unpaid_count,
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
-- 3) 월별 요약: live status를 단일 기준으로 집계
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
  v_short bigint := 0;
  v_rejected bigint := 0;
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
      count(*) filter (where f.status in ('미납', '부족', '반려'))::bigint as unpaid_count,
      count(*) filter (where f.status = '면제')::bigint as exempt_count,
      count(*) filter (where f.status = '예정')::bigint as scheduled_count,
      count(*) filter (where f.status = '가입 전')::bigint as before_join_count,
      count(*) filter (where f.status = '검수대기')::bigint as pending_count,
      count(*) filter (where f.status = '부족')::bigint as short_count,
      count(*) filter (where f.status = '반려')::bigint as rejected_count
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
          'pending', pending_count,
          'short', short_count,
          'rejected', rejected_count
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
    coalesce(sum(pending_count), 0),
    coalesce(sum(short_count), 0),
    coalesce(sum(rejected_count), 0)
  into
    v_weeks,
    v_completed,
    v_unpaid,
    v_exempt,
    v_scheduled,
    v_before_join,
    v_pending,
    v_short,
    v_rejected
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
      'pending', v_pending,
      'short', v_short,
      'rejected', v_rejected
    )
  );
end;
$$;

-- =========================================================
-- 4) 월별 매트릭스: live status를 그대로 사용
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
      (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::timestamp,
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
        'weekly_fee', new_axe_net.fund_weekly_fee(p_year, p_month, s.week)
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
      (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::timestamp,
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
      new_axe_net.fund_weekly_fee(p_year, p_month, s.week) as weekly_fee,
      f.status as display_status,
      payment.account as payment_account,
      coalesce(payment.paid_amount, 0)::integer as paid_amount
    from saturdays s
    cross join lateral new_axe_net.fund_period_status_live(
      p_year,
      p_month,
      s.week
    ) f
    left join lateral (
      select
        l.account,
        abs(l.amount)::integer as paid_amount
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
        where r.display_status in ('미납', '부족', '반려')
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
          'paid_amount', r.paid_amount,
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
-- 5) 내 공금 프로필: 공금 기준일 보정을 기간 목록에도 적용
-- =========================================================

create or replace function new_axe_net.get_my_fund_profile(
  p_member_key text,
  p_discord_user_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member new_axe_net.members%rowtype;
  v_effective_join_date date;
  v_periods jsonb := '[]'::jsonb;
  v_requests jsonb := '[]'::jsonb;
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

  select coalesce(fs.join_date_override, v_member.joined_date)
    into v_effective_join_date
  from (select 1) seed
  left join new_axe_net.fund_member_settings fs
    on fs.member_key = v_member.member_key;

  v_effective_join_date := coalesce(v_effective_join_date, v_member.joined_date);

  with period_source as (
    select
      p.year,
      p.month,
      p.week,
      new_axe_net.fund_period_end(p.year, p.month, p.week) as period_end
    from new_axe_net.get_fund_periods() p
    where new_axe_net.fund_period_end(p.year, p.month, p.week)
          >= coalesce(v_effective_join_date, date '1900-01-01')
    order by period_end desc
    limit 24
  ),
  rows as (
    select
      p.year,
      p.month,
      p.week,
      p.period_end,
      s.status,
      s.amount,
      new_axe_net.fund_weekly_fee(p.year, p.month, p.week) as weekly_fee,
      r.id as request_id,
      r.status as request_status
    from period_source p
    join lateral (
      select f.status, f.amount
      from new_axe_net.fund_period_status_live(p.year, p.month, p.week) f
      where f.member_key = v_member.member_key
      limit 1
    ) s on true
    left join lateral (
      select rr.id, rr.status
      from new_axe_net.fund_requests rr
      where rr.member_key = v_member.member_key
        and rr.year = p.year
        and rr.month = p.month
        and rr.week = p.week
      order by rr.created_at desc, rr.id desc
      limit 1
    ) r on true
    order by p.period_end desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'year', year,
        'month', month,
        'week', week,
        'period_end', period_end,
        'status', status,
        'amount', amount,
        'weekly_fee', weekly_fee,
        'request_id', request_id,
        'request_status', request_status
      )
      order by period_end desc
    ),
    '[]'::jsonb
  )
  into v_periods
  from rows;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'year', r.year,
        'month', r.month,
        'week', r.week,
        'amount', r.amount,
        'status', r.status,
        'payment_mode', r.payment_mode,
        'public_amount', r.public_amount,
        'company_amount', r.company_amount,
        'evidence_url', r.evidence_url,
        'memo', r.memo,
        'review_note', r.review_note,
        'reviewer', r.reviewer_discord_name,
        'reviewed_at', r.reviewed_at,
        'created_at', r.created_at,
        'submitted_via', r.submitted_via,
        'submitted_by_name', r.submitted_by_name,
        'proxy_admin_name', r.proxy_admin_name
      )
      order by r.created_at desc, r.id desc
    ),
    '[]'::jsonb
  )
  into v_requests
  from (
    select *
    from new_axe_net.fund_requests
    where member_key = v_member.member_key
    order by created_at desc, id desc
    limit 50
  ) r;

  return jsonb_build_object(
    'member', jsonb_build_object(
      'member_key', v_member.member_key,
      'nickname', v_member.nickname,
      'discord_name', v_member.discord_name,
      'joined_date', v_member.joined_date,
      'fund_join_date', v_effective_join_date
    ),
    'periods', v_periods,
    'requests', v_requests
  );
end;
$$;

-- =========================================================
-- 6) 정합성 리포트: 금액 불일치까지 진단
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
  v_amount_mismatch jsonb := '[]'::jsonb;
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
      r.amount,
      r.payment_mode,
      r.public_amount,
      r.company_amount
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
  into v_amount_mismatch
  from (
    with approved as (
      select
        r.*,
        case
          when coalesce(r.payment_mode, '') = '회사잔고' then 0
          when coalesce(r.payment_mode, '') = '분할납부' then coalesce(r.public_amount, 0)
          else coalesce(nullif(r.public_amount, 0), r.amount, 0)
        end::integer as expected_public,
        case
          when coalesce(r.payment_mode, '') = '회사잔고' then coalesce(nullif(r.company_amount, 0), r.amount, 0)
          when coalesce(r.payment_mode, '') = '분할납부' then coalesce(r.company_amount, 0)
          else 0
        end::integer as expected_company
      from new_axe_net.fund_requests r
      where r.status = 'approved'
    ),
    compared as (
      select
        r.id as request_id,
        r.member_key,
        r.nickname,
        r.year,
        r.month,
        r.week,
        r.amount as request_amount,
        r.payment_mode as request_payment_mode,
        r.expected_public,
        r.expected_company,
        (r.expected_public + r.expected_company)::integer as expected_total,
        l.id as ledger_id,
        l.account as ledger_account,
        case
          when l.account = '회사잔고' then 0
          when l.account = '분할납부' then coalesce(l.public_amount, 0)
          else abs(l.amount)
        end::integer as actual_public,
        case
          when l.account = '회사잔고' then abs(l.amount)
          when l.account = '분할납부' then coalesce(l.company_amount, 0)
          else 0
        end::integer as actual_company,
        abs(l.amount)::integer as ledger_amount,
        new_axe_net.fund_weekly_fee(r.year, r.month, r.week)::integer as policy_fee
      from approved r
      join lateral (
        select ll.*
        from new_axe_net.fund_ledger ll
        where ll.status = 'active'
          and ll.entry_type = 'payment'
          and ll.member_key = r.member_key
          and ll.year = r.year
          and ll.month = r.month
          and ll.week = r.week
        order by
          case when ll.request_id = r.id then 0 else 1 end,
          ll.ledger_date desc,
          ll.id desc
        limit 1
      ) l on true
    )
    select
      c.request_id,
      c.member_key,
      c.nickname,
      c.year,
      c.month,
      c.week,
      c.request_amount,
      c.request_payment_mode,
      c.expected_public,
      c.expected_company,
      c.expected_total,
      c.ledger_id,
      c.ledger_account,
      c.actual_public,
      c.actual_company,
      (c.actual_public + c.actual_company)::integer as actual_total,
      c.ledger_amount,
      c.policy_fee,
      case
        when (c.actual_public + c.actual_company) = c.policy_fee
             and c.expected_total <> c.policy_fee then 'ledger_to_request'
        when c.expected_total = c.policy_fee
             and (c.actual_public + c.actual_company) <> c.policy_fee then 'request_to_ledger'
        else 'manual'
      end as recommended_direction
    from compared c
    where c.expected_public <> c.actual_public
       or c.expected_company <> c.actual_company
    order by c.year desc, c.month desc, c.week desc, c.request_id desc
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
      r.amount,
      r.status
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
      'amount_mismatch', jsonb_array_length(v_amount_mismatch),
      'pending_with_payment', jsonb_array_length(v_pending_with_payment),
      'orphan_ledgers', jsonb_array_length(v_orphan_ledgers),
      'total',
        jsonb_array_length(v_duplicates)
        + jsonb_array_length(v_approved_missing)
        + jsonb_array_length(v_amount_mismatch)
        + jsonb_array_length(v_pending_with_payment)
        + jsonb_array_length(v_orphan_ledgers)
    ),
    'duplicates', v_duplicates,
    'approved_missing', v_approved_missing,
    'amount_mismatch', v_amount_mismatch,
    'pending_with_payment', v_pending_with_payment,
    'orphan_ledgers', v_orphan_ledgers
  );
end;
$$;

-- =========================================================
-- 7) 안전 복구: 승인 신청 -> 누락 원장 생성
-- =========================================================

create or replace function new_axe_net.repair_fund_approved_request_ledger(
  p_request_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request new_axe_net.fund_requests%rowtype;
  v_actor text;
  v_mode text;
  v_amount integer;
  v_public integer;
  v_company integer;
  v_ledger_id bigint;
  v_operation_key text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  select * into v_request
  from new_axe_net.fund_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'approved' then
    raise exception '승인 상태의 신청만 원장을 복구할 수 있습니다.' using errcode = '22023';
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
    raise exception '이미 해당 멤버·주차에 활성 납부 원장이 있습니다.' using errcode = '23505';
  end if;

  v_mode := case
    when v_request.payment_mode in ('공용계좌', '회사잔고', '분할납부') then v_request.payment_mode
    when coalesce(v_request.public_amount, 0) > 0 and coalesce(v_request.company_amount, 0) > 0 then '분할납부'
    when coalesce(v_request.company_amount, 0) > 0 then '회사잔고'
    else '공용계좌'
  end;

  v_amount := greatest(coalesce(v_request.amount, 0), 0);
  v_public := case
    when v_mode = '공용계좌' then coalesce(nullif(v_request.public_amount, 0), v_amount)
    when v_mode = '분할납부' then coalesce(v_request.public_amount, 0)
    else 0
  end;
  v_company := case
    when v_mode = '회사잔고' then coalesce(nullif(v_request.company_amount, 0), v_amount)
    when v_mode = '분할납부' then coalesce(v_request.company_amount, 0)
    else 0
  end;

  if v_amount <= 0 then
    v_amount := v_public + v_company;
  end if;
  if v_amount <= 0 then
    raise exception '복구할 신청 금액이 올바르지 않습니다.' using errcode = '22023';
  end if;

  if v_mode = '공용계좌' then
    v_public := v_amount;
    v_company := 0;
  elsif v_mode = '회사잔고' then
    v_public := 0;
    v_company := v_amount;
  elsif v_public + v_company <> v_amount then
    raise exception '분할납부 신청 금액 합계가 총액과 일치하지 않습니다. 먼저 정합성점검에서 금액을 맞춰주세요.' using errcode = '22023';
  end if;

  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');
  v_operation_key := new_axe_net.new_fund_operation_key('integrity_repair_request');

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
  ) values (
    null,
    v_request.member_key,
    v_request.nickname,
    v_request.year,
    v_request.month,
    v_request.week,
    'payment',
    v_amount,
    v_public,
    v_company,
    'active',
    coalesce(v_request.reviewer_discord_name, v_actor),
    coalesce(v_request.reviewed_at, now()),
    'new_request:' || v_request.id::text,
    v_operation_key,
    concat_ws(' · ', nullif(v_request.memo, ''), '[정합성 복구] 승인 신청 원장 누락 복구'),
    coalesce(v_request.reviewed_at, v_request.created_at, now()),
    '공금납부',
    '주간공금',
    '수입',
    v_mode,
    v_request.evidence_url,
    v_operation_key,
    v_request.id
  ) returning id into v_ledger_id;

  update new_axe_net.fund_requests
  set
    amount = v_amount,
    public_amount = v_public,
    company_amount = v_company,
    payment_mode = v_mode
  where id = v_request.id;

  insert into new_axe_net.fund_admin_audit_log (
    action, target_type, target_key, actor_user_id, actor_nickname, payload
  ) values (
    'integrity_repair_approved_request_ledger',
    'fund_request',
    v_request.id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'ledger_id', v_ledger_id,
      'member_key', v_request.member_key,
      'year', v_request.year,
      'month', v_request.month,
      'week', v_request.week,
      'amount', v_amount,
      'payment_mode', v_mode,
      'public_amount', v_public,
      'company_amount', v_company
    )
  );

  return v_ledger_id;
end;
$$;

-- =========================================================
-- 8) 안전 복구: 원장 금액을 신청에 맞춤
-- =========================================================

create or replace function new_axe_net.align_fund_ledger_to_request(
  p_request_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request new_axe_net.fund_requests%rowtype;
  v_ledger new_axe_net.fund_ledger%rowtype;
  v_actor text;
  v_mode text;
  v_amount integer;
  v_public integer;
  v_company integer;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  select * into v_request
  from new_axe_net.fund_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'approved' then
    raise exception '승인 상태의 신청만 정렬할 수 있습니다.' using errcode = '22023';
  end if;

  select * into v_ledger
  from new_axe_net.fund_ledger l
  where l.member_key = v_request.member_key
    and l.year = v_request.year
    and l.month = v_request.month
    and l.week = v_request.week
    and l.entry_type = 'payment'
    and l.status = 'active'
  order by case when l.request_id = v_request.id then 0 else 1 end, l.id desc
  limit 1
  for update;

  if not found then
    raise exception '맞출 활성 납부 원장이 없습니다. 원장 누락 복구를 먼저 실행하세요.' using errcode = '22023';
  end if;

  v_mode := case
    when v_request.payment_mode in ('공용계좌', '회사잔고', '분할납부') then v_request.payment_mode
    when coalesce(v_request.public_amount, 0) > 0 and coalesce(v_request.company_amount, 0) > 0 then '분할납부'
    when coalesce(v_request.company_amount, 0) > 0 then '회사잔고'
    else '공용계좌'
  end;
  v_amount := greatest(coalesce(v_request.amount, 0), 0);

  if v_mode = '공용계좌' then
    v_public := v_amount;
    v_company := 0;
  elsif v_mode = '회사잔고' then
    v_public := 0;
    v_company := v_amount;
  else
    v_public := greatest(coalesce(v_request.public_amount, 0), 0);
    v_company := greatest(coalesce(v_request.company_amount, 0), 0);
    if v_amount <= 0 then v_amount := v_public + v_company; end if;
    if v_public + v_company <> v_amount then
      raise exception '신청의 분할납부 합계가 총액과 일치하지 않습니다.' using errcode = '22023';
    end if;
  end if;

  if v_amount <= 0 then
    raise exception '신청 금액이 올바르지 않습니다.' using errcode = '22023';
  end if;

  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');

  update new_axe_net.fund_ledger
  set
    amount = v_amount,
    public_amount = v_public,
    company_amount = v_company,
    account = v_mode,
    request_id = v_request.id,
    legacy_request_key = coalesce(legacy_request_key, 'new_request:' || v_request.id::text),
    memo = concat_ws(' · ', nullif(memo, ''), '[정합성 보정] 신청 금액 기준'),
    approved_by_name = coalesce(approved_by_name, v_actor)
  where id = v_ledger.id;

  insert into new_axe_net.fund_admin_audit_log (
    action, target_type, target_key, actor_user_id, actor_nickname, payload
  ) values (
    'integrity_align_ledger_to_request',
    'fund_ledger',
    v_ledger.id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'request_id', v_request.id,
      'before', jsonb_build_object(
        'amount', v_ledger.amount,
        'public_amount', v_ledger.public_amount,
        'company_amount', v_ledger.company_amount,
        'account', v_ledger.account
      ),
      'after', jsonb_build_object(
        'amount', v_amount,
        'public_amount', v_public,
        'company_amount', v_company,
        'account', v_mode
      )
    )
  );

  return v_ledger.id;
end;
$$;

-- =========================================================
-- 9) 안전 복구: 신청 금액을 원장에 맞춤
-- =========================================================

create or replace function new_axe_net.align_fund_request_to_ledger(
  p_request_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request new_axe_net.fund_requests%rowtype;
  v_ledger new_axe_net.fund_ledger%rowtype;
  v_actor text;
  v_mode text;
  v_amount integer;
  v_public integer;
  v_company integer;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  select * into v_request
  from new_axe_net.fund_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'approved' then
    raise exception '승인 상태의 신청만 정렬할 수 있습니다.' using errcode = '22023';
  end if;

  select * into v_ledger
  from new_axe_net.fund_ledger l
  where l.member_key = v_request.member_key
    and l.year = v_request.year
    and l.month = v_request.month
    and l.week = v_request.week
    and l.entry_type = 'payment'
    and l.status = 'active'
  order by case when l.request_id = v_request.id then 0 else 1 end, l.id desc
  limit 1
  for update;

  if not found then
    raise exception '기준으로 사용할 활성 납부 원장이 없습니다.' using errcode = '22023';
  end if;

  v_mode := case
    when v_ledger.account in ('공용계좌', '회사잔고', '분할납부') then v_ledger.account
    when coalesce(v_ledger.public_amount, 0) > 0 and coalesce(v_ledger.company_amount, 0) > 0 then '분할납부'
    when coalesce(v_ledger.company_amount, 0) > 0 then '회사잔고'
    else '공용계좌'
  end;
  v_amount := abs(coalesce(v_ledger.amount, 0));

  if v_mode = '공용계좌' then
    v_public := v_amount;
    v_company := 0;
  elsif v_mode = '회사잔고' then
    v_public := 0;
    v_company := v_amount;
  else
    v_public := greatest(coalesce(v_ledger.public_amount, 0), 0);
    v_company := greatest(coalesce(v_ledger.company_amount, 0), 0);
    if v_public + v_company > 0 then
      v_amount := v_public + v_company;
    end if;
  end if;

  if v_amount <= 0 then
    raise exception '원장 금액이 올바르지 않습니다.' using errcode = '22023';
  end if;

  v_actor := coalesce(new_axe_net.fund_actor_nickname(), 'unknown');

  update new_axe_net.fund_requests
  set
    amount = v_amount,
    public_amount = v_public,
    company_amount = v_company,
    payment_mode = v_mode,
    review_note = concat_ws(' · ', nullif(review_note, ''), '[정합성 보정] 원장 금액 기준')
  where id = v_request.id;

  update new_axe_net.fund_ledger
  set
    request_id = v_request.id,
    legacy_request_key = coalesce(legacy_request_key, 'new_request:' || v_request.id::text)
  where id = v_ledger.id;

  insert into new_axe_net.fund_admin_audit_log (
    action, target_type, target_key, actor_user_id, actor_nickname, payload
  ) values (
    'integrity_align_request_to_ledger',
    'fund_request',
    v_request.id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'ledger_id', v_ledger.id,
      'before', jsonb_build_object(
        'amount', v_request.amount,
        'public_amount', v_request.public_amount,
        'company_amount', v_request.company_amount,
        'payment_mode', v_request.payment_mode
      ),
      'after', jsonb_build_object(
        'amount', v_amount,
        'public_amount', v_public,
        'company_amount', v_company,
        'payment_mode', v_mode
      )
    )
  );

  return v_request.id;
end;
$$;

-- =========================================================
-- 10) 권한 / PostgREST schema reload
-- =========================================================

revoke all on function new_axe_net.get_my_fund_profile(text, text) from public;
grant execute on function new_axe_net.get_my_fund_profile(text, text) to authenticated, service_role;

revoke all on function new_axe_net.get_fund_month_overview(integer, integer) from public;
grant execute on function new_axe_net.get_fund_month_overview(integer, integer) to anon, authenticated;

revoke all on function new_axe_net.get_fund_month_matrix(integer, integer) from public;
grant execute on function new_axe_net.get_fund_month_matrix(integer, integer) to anon, authenticated;

revoke all on function new_axe_net.get_fund_integrity_report() from public, anon;
grant execute on function new_axe_net.get_fund_integrity_report() to authenticated;

revoke all on function new_axe_net.repair_fund_approved_request_ledger(bigint) from public, anon;
grant execute on function new_axe_net.repair_fund_approved_request_ledger(bigint) to authenticated;

revoke all on function new_axe_net.align_fund_ledger_to_request(bigint) from public, anon;
grant execute on function new_axe_net.align_fund_ledger_to_request(bigint) to authenticated;

revoke all on function new_axe_net.align_fund_request_to_ledger(bigint) from public, anon;
grant execute on function new_axe_net.align_fund_request_to_ledger(bigint) to authenticated;

notify pgrst, 'reload schema';
