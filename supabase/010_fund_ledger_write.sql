-- AXE NET v1.2
-- 010_fund_ledger_write.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행
--
-- 핵심:
-- 1) AXE NET에서 주간 공금 납부 등록
-- 2) 일반 수입 / 지출 / 조정 등록
-- 3) 원장 행은 삭제하지 않고 cancelled 처리
-- 4) 모든 쓰기 RPC에서 is_admin() 재검사
-- 5) 변경 행위는 fund_admin_audit_log에 기록

-- 신규 원장은 레거시 id가 없으므로 nullable로 전환
alter table new_axe_net.fund_ledger
  alter column legacy_id drop not null;

-- 신규 거래 유형을 명확히 분리
alter table new_axe_net.fund_ledger
  drop constraint if exists fund_ledger_entry_type_check;

alter table new_axe_net.fund_ledger
  add constraint fund_ledger_entry_type_check
  check (
    entry_type in (
      'payment',
      'income',
      'expense',
      'adjustment',
      'refund'
    )
  );

-- updated_at 자동 갱신
drop trigger if exists fund_ledger_touch_updated_at
on new_axe_net.fund_ledger;

create trigger fund_ledger_touch_updated_at
before update on new_axe_net.fund_ledger
for each row
execute function new_axe_net.touch_updated_at();

-- 동일 멤버/주차의 active 공금 납부는 하나만 허용
-- 레거시의 member_key/week가 비어 있는 일반 항목은 대상에서 제외
create unique index if not exists fund_ledger_one_active_payment_idx
on new_axe_net.fund_ledger (
  member_key,
  year,
  month,
  week
)
where
  entry_type = 'payment'
  and status = 'active'
  and member_key is not null
  and week is not null;

-- --------------------------------------------------
-- 내부 공통: source / operation key 생성
-- --------------------------------------------------

create or replace function new_axe_net.new_fund_operation_key(
  p_prefix text
)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select
    coalesce(nullif(btrim(p_prefix), ''), 'fund') ||
    ':' ||
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text ||
    ':' ||
    substr(
      md5(
        random()::text ||
        clock_timestamp()::text
      ),
      1,
      10
    );
$$;

revoke all on function new_axe_net.new_fund_operation_key(text)
from public, anon;

grant execute on function new_axe_net.new_fund_operation_key(text)
to authenticated;

-- --------------------------------------------------
-- 주간 공금 납부 등록
-- --------------------------------------------------

create or replace function new_axe_net.create_fund_payment(
  p_member_key text,
  p_year integer,
  p_month integer,
  p_week integer,
  p_amount integer default null,
  p_account text default '공용계좌',
  p_ledger_date date default null,
  p_memo text default null
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

  if new_axe_net.fund_period_end(
    p_year,
    p_month,
    p_week
  ) is null then
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

  v_ledger_date := coalesce(
    p_ledger_date,
    (now() at time zone 'Asia/Seoul')::date
  );

  if p_account = '공용계좌' then
    v_public_amount := v_amount;
  else
    v_company_amount := v_amount;
  end if;

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  v_operation_key :=
    new_axe_net.new_fund_operation_key(
      'new_payment'
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
    source_key,
    memo,
    ledger_date,
    ledger_type,
    category,
    direction,
    account,
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
    (
      v_ledger_date::timestamp + interval '12 hours'
    ) at time zone 'Asia/Seoul',
    '공금납부',
    '주간공금',
    '수입',
    p_account,
    v_operation_key
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
    'create_payment',
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
      'memo', nullif(btrim(p_memo), '')
    )
  );

  return v_id;
end;
$$;

-- --------------------------------------------------
-- 일반 수입 / 지출 / 조정 등록
--
-- 수입, 지출:
--   p_amount는 양수
--
-- 조정:
--   증가 = 양수
--   감소 = 음수
-- --------------------------------------------------

create or replace function new_axe_net.create_fund_transaction(
  p_direction text,
  p_account text,
  p_amount integer,
  p_category text,
  p_ledger_date date default null,
  p_member_key text default null,
  p_memo text default null
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

  if p_direction in ('수입', '지출')
     and p_amount < 0 then
    raise exception '수입/지출 금액은 양수로 입력하세요.'
      using errcode = '22023';
  end if;

  if p_member_key is not null
     and nullif(btrim(p_member_key), '') is not null then
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

  v_entry_type :=
    case p_direction
      when '수입' then 'income'
      when '지출' then 'expense'
      else 'adjustment'
    end;

  v_ledger_type :=
    case p_direction
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

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  v_operation_key :=
    new_axe_net.new_fund_operation_key(
      'new_transaction'
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
    source_key,
    memo,
    ledger_date,
    ledger_type,
    category,
    direction,
    account,
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
    (
      v_ledger_date::timestamp + interval '12 hours'
    ) at time zone 'Asia/Seoul',
    v_ledger_type,
    btrim(p_category),
    p_direction,
    p_account,
    v_operation_key
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
    'create_transaction',
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
      'memo', nullif(btrim(p_memo), '')
    )
  );

  return v_id;
end;
$$;

-- --------------------------------------------------
-- 원장 취소
-- 삭제하지 않고 status=cancelled로 보존
-- --------------------------------------------------

create or replace function new_axe_net.cancel_fund_ledger_entry(
  p_ledger_id bigint,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row new_axe_net.fund_ledger%rowtype;
  v_actor text;
begin
  if not new_axe_net.is_admin() then
    raise exception '관리자 권한이 필요합니다.'
      using errcode = '42501';
  end if;

  select *
    into v_row
  from new_axe_net.fund_ledger
  where id = p_ledger_id
  for update;

  if not found then
    raise exception '원장 기록을 찾을 수 없습니다.'
      using errcode = '22023';
  end if;

  if v_row.status = 'cancelled' then
    raise exception '이미 취소된 원장 기록입니다.'
      using errcode = '22023';
  end if;

  update new_axe_net.fund_ledger
  set status = 'cancelled'
  where id = p_ledger_id;

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  insert into new_axe_net.fund_admin_audit_log (
    action,
    target_type,
    target_key,
    actor_user_id,
    actor_nickname,
    payload
  )
  values (
    'cancel_ledger',
    'fund_ledger',
    p_ledger_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'entry_type', v_row.entry_type,
      'nickname', v_row.nickname,
      'year', v_row.year,
      'month', v_row.month,
      'week', v_row.week,
      'amount', v_row.amount,
      'direction', v_row.direction,
      'account', v_row.account,
      'category', v_row.category,
      'reason', nullif(btrim(p_reason), '')
    )
  );
end;
$$;

-- --------------------------------------------------
-- 권한
-- --------------------------------------------------

revoke all on function new_axe_net.create_fund_payment(
  text,
  integer,
  integer,
  integer,
  integer,
  text,
  date,
  text
) from public, anon;

revoke all on function new_axe_net.create_fund_transaction(
  text,
  text,
  integer,
  text,
  date,
  text,
  text
) from public, anon;

revoke all on function new_axe_net.cancel_fund_ledger_entry(
  bigint,
  text
) from public, anon;

grant execute on function new_axe_net.create_fund_payment(
  text,
  integer,
  integer,
  integer,
  integer,
  text,
  date,
  text
) to authenticated;

grant execute on function new_axe_net.create_fund_transaction(
  text,
  text,
  integer,
  text,
  date,
  text,
  text
) to authenticated;

grant execute on function new_axe_net.cancel_fund_ledger_entry(
  bigint,
  text
) to authenticated;

notify pgrst, 'reload schema';
