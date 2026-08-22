-- NEW AXE NET v1.3
-- 011_fund_requests_workflow.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행
--
-- 추가:
-- 1) 멤버용 공금 납부 신청
-- 2) 관리자 요청함
-- 3) 승인 -> fund_ledger payment 자동 생성
-- 4) 거절
-- 5) 요청/승인/거절 감사 로그
--
-- 보안:
-- - fund_requests 직접 INSERT/UPDATE 권한은 열지 않음
-- - 공개 제출은 SECURITY DEFINER RPC만 허용
-- - 제출 시 member_key + Discord 사용자 ID 일치 검증
-- - 승인/거절은 is_admin() 재검사

-- --------------------------------------------------
-- 신규 요청을 받을 수 있도록 레거시 제약 확장
-- --------------------------------------------------

alter table new_axe_net.fund_requests
  alter column legacy_id drop not null;

alter table new_axe_net.fund_requests
  drop constraint if exists fund_requests_status_check;

alter table new_axe_net.fund_requests
  add constraint fund_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'deleted'));

alter table new_axe_net.fund_requests
  add column if not exists review_note text;

alter table new_axe_net.fund_requests
  add column if not exists submitted_via text not null default 'legacy';

drop trigger if exists fund_requests_touch_updated_at
on new_axe_net.fund_requests;

create trigger fund_requests_touch_updated_at
before update on new_axe_net.fund_requests
for each row
execute function new_axe_net.touch_updated_at();

-- 같은 멤버 / 같은 주차에는 pending 요청 하나만 허용
create unique index if not exists fund_requests_one_pending_period_idx
on new_axe_net.fund_requests (
  member_key,
  year,
  month,
  week
)
where status = 'pending';

-- --------------------------------------------------
-- 멤버 공금 신청
-- --------------------------------------------------

create or replace function new_axe_net.submit_fund_request(
  p_member_key text,
  p_discord_user_id text,
  p_year integer,
  p_month integer,
  p_week integer,
  p_amount integer default null,
  p_payment_mode text default '공용계좌',
  p_evidence_url text default null,
  p_memo text default null
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
  v_source_key text;
  v_period_end date;
  v_period_start date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
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

  if p_payment_mode not in ('공용계좌', '회사잔고') then
    raise exception '올바르지 않은 입금 계좌입니다.'
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
      and r.status = 'pending'
  ) then
    raise exception '이미 검토 대기 중인 신청이 있습니다.'
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
    raise exception '신청 금액은 0원보다 커야 합니다.'
      using errcode = '22023';
  end if;

  v_source_key :=
    new_axe_net.new_fund_operation_key(
      'web_fund_request'
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
    submitted_via
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
    nullif(btrim(p_evidence_url), ''),
    nullif(btrim(p_memo), ''),
    null,
    null,
    v_source_key,
    p_payment_mode,
    0,
    0,
    v_source_key,
    null,
    'web'
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
    'submit_request',
    'fund_request',
    v_id::text,
    null,
    v_member.nickname,
    jsonb_build_object(
      'member_key', p_member_key,
      'nickname', v_member.nickname,
      'discord_user_id', btrim(p_discord_user_id),
      'year', p_year,
      'month', p_month,
      'week', p_week,
      'amount', v_amount,
      'payment_mode', p_payment_mode,
      'evidence_url', nullif(btrim(p_evidence_url), ''),
      'memo', nullif(btrim(p_memo), ''),
      'submitted_via', 'web'
    )
  );

  return v_id;
end;
$$;

-- --------------------------------------------------
-- 관리자 승인
-- 승인과 원장 생성은 하나의 트랜잭션 안에서 처리
-- --------------------------------------------------

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

  if v_request.status <> 'pending' then
    raise exception '이미 처리된 신청입니다.'
      using errcode = '22023';
  end if;

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  v_ledger_id := new_axe_net.create_fund_payment(
    v_request.member_key,
    v_request.year,
    v_request.month,
    v_request.week,
    v_request.amount,
    v_request.payment_mode,
    (now() at time zone 'Asia/Seoul')::date,
    concat(
      '공금 신청 #',
      v_request.id,
      case
        when v_request.memo is null then ''
        else ' · ' || v_request.memo
      end
    )
  );

  update new_axe_net.fund_requests
  set
    status = 'approved',
    reviewer_discord_name = v_actor,
    reviewed_at = now(),
    review_note = nullif(btrim(p_review_note), ''),
    public_amount = case
      when v_request.payment_mode = '공용계좌'
      then v_request.amount
      else 0
    end,
    company_amount = case
      when v_request.payment_mode = '회사잔고'
      then v_request.amount
      else 0
    end
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
      'review_note', nullif(btrim(p_review_note), '')
    )
  );

  return v_ledger_id;
end;
$$;

-- --------------------------------------------------
-- 관리자 거절
-- --------------------------------------------------

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

  if v_request.status <> 'pending' then
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

-- --------------------------------------------------
-- 권한
-- --------------------------------------------------

revoke all on function new_axe_net.submit_fund_request(
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  text,
  text,
  text
) from public;

grant execute on function new_axe_net.submit_fund_request(
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  text,
  text,
  text
) to anon, authenticated;

revoke all on function new_axe_net.approve_fund_request(
  bigint,
  text
) from public, anon;

revoke all on function new_axe_net.reject_fund_request(
  bigint,
  text
) from public, anon;

grant execute on function new_axe_net.approve_fund_request(
  bigint,
  text
) to authenticated;

grant execute on function new_axe_net.reject_fund_request(
  bigint,
  text
) to authenticated;

notify pgrst, 'reload schema';
