-- NEW AXE NET bootstrap
-- AXE WAR 프로젝트의 SQL Editor에서 실행합니다.

create schema if not exists new_axe_net;

grant usage on schema new_axe_net to anon, authenticated;

create table if not exists new_axe_net.app_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table new_axe_net.app_meta enable row level security;

grant select on table new_axe_net.app_meta to anon, authenticated;

drop policy if exists "app_meta_read" on new_axe_net.app_meta;

create policy "app_meta_read"
on new_axe_net.app_meta
for select
to anon, authenticated
using (true);

insert into new_axe_net.app_meta (key, value)
values ('health', 'NEW AXE NET DB READY')
on conflict (key)
do update set
  value = excluded.value,
  updated_at = now();
