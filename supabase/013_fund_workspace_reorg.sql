-- NEW AXE NET v1.5
-- 013_fund_workspace_reorg.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행
--
-- 목적
-- 1) 공금 화면을 실제 운영 흐름 중심으로 재구성하기 위한 조회 API
-- 2) 본인 공금현황 / 내 제출 안전 조회
-- 3) 월별현황 집계
-- 4) 관리자 잔액점검 기록
--
-- 화면 명칭
-- 월별현황 / 공금납부 / 내 제출 / 검수대기 / 공금내역 / 잔액점검 / 공금설정

-- --------------------------------------------------
-- 월별현황
-- 월의 모든 토요일을 주차로 생성하고 LIVE ENGINE으로 집계합니다.
-- --------------------------------------------------
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
          and r.status = 'pending'
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

revoke all on function new_axe_net.get_fund_month_overview(integer, integer)
from public;

grant execute on function new_axe_net.get_fund_month_overview(integer, integer)
to anon, authenticated;

-- --------------------------------------------------
-- 본인 공금현황 + 내 제출
-- member_key와 Discord 숫자 ID가 DB와 일치할 때만 반환합니다.
-- 일반 멤버 로그인 체계가 붙기 전의 과도기 안전장치입니다.
-- --------------------------------------------------
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
  v_periods jsonb := '[]'::jsonb;
  v_requests jsonb := '[]'::jsonb;
begin
  if nullif(btrim(p_discord_user_id), '') is null then
    raise exception 'Discord 사용자 ID를 입력하세요.'
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

  if v_member.discord_user_id is null then
    raise exception 'Discord ID가 등록되지 않은 멤버입니다. 관리자에게 문의하세요.'
      using errcode = '22023';
  end if;

  if btrim(v_member.discord_user_id) <> btrim(p_discord_user_id) then
    raise exception '멤버 정보와 Discord 사용자 ID가 일치하지 않습니다.'
      using errcode = '42501';
  end if;

  with period_source as (
    select
      p.year,
      p.month,
      p.week,
      new_axe_net.fund_period_end(p.year, p.month, p.week) as period_end
    from new_axe_net.get_fund_periods() p
    where new_axe_net.fund_period_end(p.year, p.month, p.week) >= v_member.joined_date
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
      from new_axe_net.fund_period_status_live(
        p.year,
        p.month,
        p.week
      ) f
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
        'evidence_url', r.evidence_url,
        'memo', r.memo,
        'review_note', r.review_note,
        'reviewer', r.reviewer_discord_name,
        'reviewed_at', r.reviewed_at,
        'created_at', r.created_at,
        'submitted_via', r.submitted_via
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
      'joined_date', v_member.joined_date
    ),
    'periods', v_periods,
    'requests', v_requests
  );
end;
$$;

revoke all on function new_axe_net.get_my_fund_profile(text, text)
from public;

grant execute on function new_axe_net.get_my_fund_profile(text, text)
to anon, authenticated;

-- --------------------------------------------------
-- 관리자 잔액점검
-- 시스템 계산 잔액과 실제 보유액을 같은 시점에 기록합니다.
-- --------------------------------------------------
create table if not exists new_axe_net.fund_balance_checks (
  id bigint generated by default as identity primary key,
  computed_public integer not null,
  computed_company integer not null,
  actual_public integer not null,
  actual_company integer not null,
  difference_public integer not null,
  difference_company integer not null,
  checked_by_user_id uuid,
  checked_by_name text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists fund_balance_checks_created_at_idx
on new_axe_net.fund_balance_checks (created_at desc);

alter table new_axe_net.fund_balance_checks enable row level security;
revoke all on table new_axe_net.fund_balance_checks from anon, authenticated;
grant select on table new_axe_net.fund_balance_checks to authenticated;

drop policy if exists "fund_balance_checks_admin_read"
on new_axe_net.fund_balance_checks;

create policy "fund_balance_checks_admin_read"
on new_axe_net.fund_balance_checks
for select to authenticated
using (new_axe_net.is_admin());

create or replace function new_axe_net.create_fund_balance_check(
  p_actual_public integer,
  p_actual_company integer,
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

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  insert into new_axe_net.fund_balance_checks (
    computed_public,
    computed_company,
    actual_public,
    actual_company,
    difference_public,
    difference_company,
    checked_by_user_id,
    checked_by_name,
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
    'balance_check',
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
      'note', nullif(btrim(p_note), '')
    )
  );

  return v_id;
end;
$$;

revoke all on function new_axe_net.create_fund_balance_check(integer, integer, text)
from public, anon;

grant execute on function new_axe_net.create_fund_balance_check(integer, integer, text)
to authenticated;

notify pgrst, 'reload schema';
