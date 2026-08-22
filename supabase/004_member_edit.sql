-- NEW AXE NET v0.6
-- 004_member_edit.sql
-- AXE WAR Supabase 프로젝트 > SQL Editor에서 전체 실행

-- 관리자에게 members 전체 컬럼 UPDATE 권한을 주지 않고
-- NEW AXE NET UI에서 실제로 수정하는 컬럼만 허용합니다.
revoke update on table new_axe_net.members from authenticated;

grant update (
  nickname,
  role,
  status,
  badge,
  points,
  resigned_at
)
on new_axe_net.members
to authenticated;

-- 상태/퇴사일 정합성 유지:
-- resigned인데 퇴사일이 비어 있으면 오늘 날짜 자동 입력
-- active/inactive이면 퇴사일 자동 제거
create or replace function new_axe_net.normalize_member_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'resigned' then
    if new.resigned_at is null then
      new.resigned_at = current_date;
    end if;
  else
    new.resigned_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists members_normalize_status
on new_axe_net.members;

create trigger members_normalize_status
before insert or update of status, resigned_at
on new_axe_net.members
for each row
execute function new_axe_net.normalize_member_status();

notify pgrst, 'reload schema';
