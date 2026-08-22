-- NEW AXE NET v1.12.0
-- 017_fund_submit_parity.sql
-- 기존 AXE NET 공금납부 / 내 제출 / 검수대기 패리티 1차
--
-- 추가:
-- 1) 분할납부 (공용계좌 + 회사잔고)
-- 2) 관리자 대리제출 메타데이터
-- 3) 비공개 Supabase Storage 증빙 버킷
-- 4) 승인 시 split 금액 + 증빙을 원장에 그대로 연결
-- 5) 내 제출에 split / 대리제출 정보 반환
--
-- 추가 CSV Import 없음.

-- --------------------------------------------------
-- 요청 / 원장 스키마 보강
-- --------------------------------------------------

alter table new_axe_net.fund_requests
  add column if not exists submitted_by_name text;

alter table new_axe_net.fund_requests
  add column if not exists proxy_admin_name text;

alter table new_axe_net.fund_requests
  drop constraint if exists fund_requests_payment_mode_check;

alter table new_axe_net.fund_requests
  add constraint fund_requests_payment_mode_check
  check (
    payment_mode is null
    or payment_mode in ('공용계좌', '회사잔고', '분할납부')
  );

alter table new_axe_net.fund_ledger
  drop constraint if exists fund_ledger_account_check;

alter table new_axe_net.fund_ledger
  add constraint fund_ledger_account_check
  check (account in ('공용계좌', '회사잔고', '분할납부'));

-- --------------------------------------------------
-- 비공개 증빙 Storage
-- service_role: 업로드/서명 가능 (RLS bypass)
-- Supabase 관리자: 검수 화면에서 private signed URL 생성 가능
-- --------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'fund-evidence',
  'fund-evidence',
  false,
  3145728,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fund_evidence_admin_select"
on storage.objects;

drop policy if exists "fund_evidence_admin_insert"
on storage.objects;

drop policy if exists "fund_evidence_admin_delete"
on storage.objects;

create policy "fund_evidence_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fund-evidence'
  and new_axe_net.is_admin()
);

create policy "fund_evidence_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fund-evidence'
  and new_axe_net.is_admin()
);

create policy "fund_evidence_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fund-evidence'
  and new_axe_net.is_admin()
);

-- --------------------------------------------------
-- 공금 신청 V2
-- 기존 AXE NET 동작:
-- - 일반 회원: 로그인 사용자 본인 제출
-- - 관리자: 대상 멤버 선택 대리제출 가능
-- - 증빙 필수는 서버/API 계층에서도 별도 검사
-- - 공용 / 잔고 / 분할납부 지원
-- --------------------------------------------------

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
      and r.status = 'pending'
  ) then
    raise exception '이미 검수대기 중인 신청이 있습니다.'
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

revoke all on function new_axe_net.submit_fund_request_v2(
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) from public, anon;

grant execute on function new_axe_net.submit_fund_request_v2(
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text
) to authenticated, service_role;

-- --------------------------------------------------
-- 승인 V2 동작
-- 요청의 split / evidence 값을 원장에 그대로 반영합니다.
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

  if v_request.status <> 'pending' then
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

-- --------------------------------------------------
-- 본인 공금 프로필 패리티 보강
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

  with period_source as (
    select
      p.year,
      p.month,
      p.week,
      new_axe_net.fund_period_end(
        p.year,
        p.month,
        p.week
      ) as period_end
    from new_axe_net.get_fund_periods() p
    where new_axe_net.fund_period_end(
      p.year,
      p.month,
      p.week
    ) >= v_member.joined_date
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
      new_axe_net.fund_weekly_fee(
        p.year,
        p.month,
        p.week
      ) as weekly_fee,
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
to authenticated, service_role;

notify pgrst, 'reload schema';
