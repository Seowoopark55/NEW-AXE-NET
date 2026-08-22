-- NEW AXE NET v1.4
-- 012_fund_ledger_edit_delete.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행
--
-- 추가:
-- 1) 공금 원장 수정
-- 2) 공금 원장 삭제(물리 삭제 금지 / soft delete)
-- 3) 삭제된 원장 복구
-- 4) 승인 요청 ↔ 생성 원장 연결
-- 5) 수정/삭제/복구 감사 로그
--
-- 회계 원장은 실제 DELETE 하지 않습니다.
-- UI에서 '삭제'를 눌러도 status=cancelled 로 남기고
-- deleted_at / deleted_by / delete_reason 을 기록합니다.

-- --------------------------------------------------
-- 원장 ↔ 신청 연결 및 삭제 메타
-- --------------------------------------------------

alter table new_axe_net.fund_ledger
  add column if not exists request_id bigint;

alter table new_axe_net.fund_ledger
  add column if not exists deleted_at timestamptz;

alter table new_axe_net.fund_ledger
  add column if not exists deleted_by text;

alter table new_axe_net.fund_ledger
  add column if not exists delete_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fund_ledger_request_id_fkey'
      and conrelid = 'new_axe_net.fund_ledger'::regclass
  ) then
    alter table new_axe_net.fund_ledger
      add constraint fund_ledger_request_id_fkey
      foreign key (request_id)
      references new_axe_net.fund_requests(id)
      on delete set null;
  end if;
end
$$;

create index if not exists fund_ledger_request_id_idx
on new_axe_net.fund_ledger (request_id);

-- v1.3에서 이미 승인한 NEW 요청이 있다면 audit log의 ledger_id로 연결
update new_axe_net.fund_ledger l
set
  request_id = a.target_key::bigint,
  legacy_request_key = coalesce(
    l.legacy_request_key,
    'new_request:' || a.target_key
  )
from new_axe_net.fund_admin_audit_log a
where a.action = 'approve_request'
  and a.target_type = 'fund_request'
  and nullif(a.payload->>'ledger_id', '') is not null
  and (a.payload->>'ledger_id')::bigint = l.id
  and l.request_id is null;

-- --------------------------------------------------
-- 승인 RPC 보강
-- 승인 직후 생성된 원장에 request_id를 연결
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

  update new_axe_net.fund_ledger
  set
    request_id = p_request_id,
    legacy_request_key = coalesce(
      legacy_request_key,
      'new_request:' || p_request_id::text
    )
  where id = v_ledger_id;

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
-- 원장 수정
--
-- payment:
--   멤버/주차는 고정
--   금액/계좌/처리일/메모만 수정
--   승인 요청과 연결된 payment면 request 금액/계좌도 동기화
--
-- 일반 원장:
--   수입/지출/조정, 계좌, 금액, 분류, 관련 멤버,
--   처리일, 메모 수정 가능
-- --------------------------------------------------

create or replace function new_axe_net.update_fund_ledger_entry(
  p_ledger_id bigint,
  p_amount integer,
  p_account text,
  p_ledger_date date,
  p_direction text default null,
  p_category text default null,
  p_member_key text default null,
  p_memo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row new_axe_net.fund_ledger%rowtype;
  v_actor text;
  v_nickname text;
  v_public_amount integer := 0;
  v_company_amount integer := 0;
  v_new_entry_type text;
  v_old jsonb;
  v_new jsonb;
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

  if v_row.status <> 'active' then
    raise exception '삭제된 원장은 수정할 수 없습니다. 먼저 복구하세요.'
      using errcode = '22023';
  end if;

  if p_account not in ('공용계좌', '회사잔고') then
    raise exception '올바르지 않은 계좌입니다.'
      using errcode = '22023';
  end if;

  if p_ledger_date is null then
    raise exception '처리일을 입력하세요.'
      using errcode = '22023';
  end if;

  v_old := jsonb_build_object(
    'entry_type', v_row.entry_type,
    'member_key', v_row.member_key,
    'nickname', v_row.nickname,
    'year', v_row.year,
    'month', v_row.month,
    'week', v_row.week,
    'amount', v_row.amount,
    'direction', v_row.direction,
    'account', v_row.account,
    'category', v_row.category,
    'ledger_date', v_row.ledger_date,
    'memo', v_row.memo,
    'request_id', v_row.request_id
  );

  if v_row.entry_type = 'payment' then
    if p_amount is null or p_amount <= 0 then
      raise exception '납부 금액은 0원보다 커야 합니다.'
        using errcode = '22023';
    end if;

    if p_account = '공용계좌' then
      v_public_amount := p_amount;
    else
      v_company_amount := p_amount;
    end if;

    update new_axe_net.fund_ledger
    set
      amount = p_amount,
      public_amount = v_public_amount,
      company_amount = v_company_amount,
      account = p_account,
      ledger_date = (
        p_ledger_date::timestamp + interval '12 hours'
      ) at time zone 'Asia/Seoul',
      memo = nullif(btrim(p_memo), '')
    where id = p_ledger_id;

    if v_row.request_id is not null then
      update new_axe_net.fund_requests
      set
        amount = p_amount,
        payment_mode = p_account,
        public_amount = case
          when p_account = '공용계좌' then p_amount
          else 0
        end,
        company_amount = case
          when p_account = '회사잔고' then p_amount
          else 0
        end
      where id = v_row.request_id;
    end if;
  else
    if p_direction not in ('수입', '지출', '조정') then
      raise exception '올바르지 않은 거래 유형입니다.'
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

    if nullif(btrim(p_member_key), '') is not null then
      select m.nickname
        into v_nickname
      from new_axe_net.members m
      where m.member_key = btrim(p_member_key)
      limit 1;

      if v_nickname is null then
        raise exception '관련 멤버를 찾을 수 없습니다.'
          using errcode = '22023';
      end if;
    else
      p_member_key := null;
      v_nickname := null;
    end if;

    if p_account = '공용계좌' then
      v_public_amount := p_amount;
    else
      v_company_amount := p_amount;
    end if;

    v_new_entry_type :=
      case
        when v_row.entry_type in ('income', 'expense', 'adjustment')
          then case p_direction
            when '수입' then 'income'
            when '지출' then 'expense'
            else 'adjustment'
          end
        else v_row.entry_type
      end;

    update new_axe_net.fund_ledger
    set
      member_key = p_member_key,
      nickname = v_nickname,
      entry_type = v_new_entry_type,
      amount = p_amount,
      public_amount = v_public_amount,
      company_amount = v_company_amount,
      direction = p_direction,
      account = p_account,
      category = btrim(p_category),
      ledger_type = case p_direction
        when '수입' then '수입'
        when '지출' then '지출'
        else '조정'
      end,
      ledger_date = (
        p_ledger_date::timestamp + interval '12 hours'
      ) at time zone 'Asia/Seoul',
      memo = nullif(btrim(p_memo), '')
    where id = p_ledger_id;
  end if;

  select *
    into v_row
  from new_axe_net.fund_ledger
  where id = p_ledger_id;

  v_new := jsonb_build_object(
    'entry_type', v_row.entry_type,
    'member_key', v_row.member_key,
    'nickname', v_row.nickname,
    'year', v_row.year,
    'month', v_row.month,
    'week', v_row.week,
    'amount', v_row.amount,
    'direction', v_row.direction,
    'account', v_row.account,
    'category', v_row.category,
    'ledger_date', v_row.ledger_date,
    'memo', v_row.memo,
    'request_id', v_row.request_id
  );

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
    'update_ledger',
    'fund_ledger',
    p_ledger_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'old', v_old,
      'new', v_new
    )
  );
end;
$$;

-- --------------------------------------------------
-- 원장 삭제 = soft delete
-- --------------------------------------------------

create or replace function new_axe_net.delete_fund_ledger_entry(
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
    raise exception '이미 삭제된 원장 기록입니다.'
      using errcode = '22023';
  end if;

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  update new_axe_net.fund_ledger
  set
    status = 'cancelled',
    deleted_at = now(),
    deleted_by = v_actor,
    delete_reason = nullif(btrim(p_reason), '')
  where id = p_ledger_id;

  -- 승인 요청으로 생성된 원장을 삭제하면 요청도 deleted 처리
  -- 그래야 같은 주차에 새 요청을 다시 제출할 수 있음
  if v_row.request_id is not null then
    update new_axe_net.fund_requests
    set
      status = 'deleted',
      reviewer_discord_name = v_actor,
      reviewed_at = now(),
      review_note = concat_ws(
        ' · ',
        nullif(review_note, ''),
        case
          when nullif(btrim(p_reason), '') is null
            then '승인 원장 삭제'
          else '승인 원장 삭제: ' || btrim(p_reason)
        end
      )
    where id = v_row.request_id;
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
    'delete_ledger',
    'fund_ledger',
    p_ledger_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'entry_type', v_row.entry_type,
      'member_key', v_row.member_key,
      'nickname', v_row.nickname,
      'year', v_row.year,
      'month', v_row.month,
      'week', v_row.week,
      'amount', v_row.amount,
      'direction', v_row.direction,
      'account', v_row.account,
      'category', v_row.category,
      'request_id', v_row.request_id,
      'reason', nullif(btrim(p_reason), '')
    )
  );
end;
$$;

-- --------------------------------------------------
-- 삭제 원장 복구
-- --------------------------------------------------

create or replace function new_axe_net.restore_fund_ledger_entry(
  p_ledger_id bigint
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

  if v_row.status <> 'cancelled' then
    raise exception '삭제된 원장만 복구할 수 있습니다.'
      using errcode = '22023';
  end if;

  if v_row.entry_type = 'payment'
     and exists (
       select 1
       from new_axe_net.fund_ledger l
       where l.id <> p_ledger_id
         and l.member_key = v_row.member_key
         and l.year = v_row.year
         and l.month = v_row.month
         and l.week = v_row.week
         and l.entry_type = 'payment'
         and l.status = 'active'
     ) then
    raise exception '같은 멤버/주차에 다른 활성 납부 기록이 있어 복구할 수 없습니다.'
      using errcode = '23505';
  end if;

  v_actor := coalesce(
    new_axe_net.fund_actor_nickname(),
    'unknown'
  );

  update new_axe_net.fund_ledger
  set
    status = 'active',
    deleted_at = null,
    deleted_by = null,
    delete_reason = null
  where id = p_ledger_id;

  if v_row.request_id is not null then
    update new_axe_net.fund_requests
    set
      status = 'approved',
      reviewer_discord_name = v_actor,
      reviewed_at = now()
    where id = v_row.request_id;
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
    'restore_ledger',
    'fund_ledger',
    p_ledger_id::text,
    auth.uid(),
    v_actor,
    jsonb_build_object(
      'entry_type', v_row.entry_type,
      'member_key', v_row.member_key,
      'nickname', v_row.nickname,
      'year', v_row.year,
      'month', v_row.month,
      'week', v_row.week,
      'amount', v_row.amount,
      'request_id', v_row.request_id
    )
  );
end;
$$;

-- 기존 v1.2 cancel RPC는 호환용으로 유지하되
-- 이제 delete_fund_ledger_entry()와 같은 soft-delete 경로 사용
create or replace function new_axe_net.cancel_fund_ledger_entry(
  p_ledger_id bigint,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform new_axe_net.delete_fund_ledger_entry(
    p_ledger_id,
    p_reason
  );
end;
$$;

-- --------------------------------------------------
-- 권한
-- --------------------------------------------------

revoke all on function new_axe_net.update_fund_ledger_entry(
  bigint,
  integer,
  text,
  date,
  text,
  text,
  text,
  text
) from public, anon;

revoke all on function new_axe_net.delete_fund_ledger_entry(
  bigint,
  text
) from public, anon;

revoke all on function new_axe_net.restore_fund_ledger_entry(
  bigint
) from public, anon;

grant execute on function new_axe_net.update_fund_ledger_entry(
  bigint,
  integer,
  text,
  date,
  text,
  text,
  text,
  text
) to authenticated;

grant execute on function new_axe_net.delete_fund_ledger_entry(
  bigint,
  text
) to authenticated;

grant execute on function new_axe_net.restore_fund_ledger_entry(
  bigint
) to authenticated;

notify pgrst, 'reload schema';
