-- AXE NET v1.47.5
-- Complete skill-point requirement refresh · 2026-08-27
--
-- Source: user-provided CSV "스킬포인트 필요량 - 스킬포인트 요구량.csv".
-- This migration treats the CSV as the current source of truth for the listed skills.
--
-- Policy:
--   1) Confirmed SP cells are inserted exactly as supplied.
--   2) '-' and '현재 없음' mean there is no current rank transition row; stale rows are removed.
--   3) A → 9 training-book requirements are stored in note.
--   4) Existing canonical skill name '재련' is retained for compatibility; source CSV label is '제련'.
--   5) Obsolete '아이언 주' rows are removed and replaced by confirmed '악기연주' data.
--
begin;

-- Remove the previous rows for the covered skills so unavailable/stale transitions cannot survive.
delete from new_axe_net.info_skill_ranks
where skill in (
  '벌목', '채광', '낚시', '보물찾기', '채집', '택배', '차량 정비', '절도', '목재 가공', '재련', '제작', '요리', '감정', '전문가 치료(EMS)', '몸 수색(경찰)', '전력질주', '체력', '컴뱃롤', '돌진', '운전', '작곡', '악기연주', '피스톨 마스터리', 'SMG 마스터리', '아이언 주', '제련'
);

insert into new_axe_net.info_skill_ranks
  (legacy_key, skill, rank, required_point, point_type, note, sort_order)
values
  ('skill:벌목:1:연습 → F','벌목','연습 → F',2,'sp',null,1),
  ('skill:벌목:2:F → E','벌목','F → E',3,'sp',null,2),
  ('skill:벌목:3:E → D','벌목','E → D',6,'sp',null,3),
  ('skill:벌목:4:D → C','벌목','D → C',10,'sp',null,4),
  ('skill:벌목:5:C → B','벌목','C → B',12,'sp',null,5),
  ('skill:벌목:6:B → A','벌목','B → A',14,'sp',null,6),
  ('skill:벌목:7:A → 9','벌목','A → 9',45,'sp','수련서 3장 추가 필요',7),
  ('skill:채광:1:연습 → F','채광','연습 → F',2,'sp',null,1),
  ('skill:채광:2:F → E','채광','F → E',3,'sp',null,2),
  ('skill:채광:3:E → D','채광','E → D',6,'sp',null,3),
  ('skill:채광:4:D → C','채광','D → C',10,'sp',null,4),
  ('skill:채광:5:C → B','채광','C → B',12,'sp',null,5),
  ('skill:채광:6:B → A','채광','B → A',14,'sp',null,6),
  ('skill:채광:7:A → 9','채광','A → 9',45,'sp','수련서 3장 추가 필요',7),
  ('skill:낚시:1:연습 → F','낚시','연습 → F',2,'sp',null,1),
  ('skill:낚시:2:F → E','낚시','F → E',3,'sp',null,2),
  ('skill:낚시:3:E → D','낚시','E → D',6,'sp',null,3),
  ('skill:낚시:4:D → C','낚시','D → C',10,'sp',null,4),
  ('skill:낚시:5:C → B','낚시','C → B',12,'sp',null,5),
  ('skill:낚시:6:B → A','낚시','B → A',15,'sp',null,6),
  ('skill:낚시:7:A → 9','낚시','A → 9',45,'sp','수련서 3장 추가 필요',7),
  ('skill:보물찾기:1:연습 → F','보물찾기','연습 → F',2,'sp',null,1),
  ('skill:보물찾기:2:F → E','보물찾기','F → E',4,'sp',null,2),
  ('skill:보물찾기:3:E → D','보물찾기','E → D',6,'sp',null,3),
  ('skill:보물찾기:4:D → C','보물찾기','D → C',9,'sp',null,4),
  ('skill:보물찾기:5:C → B','보물찾기','C → B',12,'sp',null,5),
  ('skill:보물찾기:6:B → A','보물찾기','B → A',15,'sp',null,6),
  ('skill:채집:1:연습 → F','채집','연습 → F',2,'sp',null,1),
  ('skill:채집:2:F → E','채집','F → E',3,'sp',null,2),
  ('skill:채집:3:E → D','채집','E → D',6,'sp',null,3),
  ('skill:채집:4:D → C','채집','D → C',10,'sp',null,4),
  ('skill:택배:1:연습 → F','택배','연습 → F',2,'sp',null,1),
  ('skill:택배:2:F → E','택배','F → E',4,'sp',null,2),
  ('skill:택배:3:E → D','택배','E → D',6,'sp',null,3),
  ('skill:택배:4:D → C','택배','D → C',9,'sp',null,4),
  ('skill:택배:5:C → B','택배','C → B',12,'sp',null,5),
  ('skill:택배:6:B → A','택배','B → A',15,'sp',null,6),
  ('skill:택배:7:A → 9','택배','A → 9',45,'sp','수련서 3장 추가 필요',7),
  ('skill:차량 정비:1:연습 → F','차량 정비','연습 → F',2,'sp',null,1),
  ('skill:차량 정비:2:F → E','차량 정비','F → E',4,'sp',null,2),
  ('skill:차량 정비:3:E → D','차량 정비','E → D',6,'sp',null,3),
  ('skill:차량 정비:4:D → C','차량 정비','D → C',10,'sp',null,4),
  ('skill:차량 정비:5:C → B','차량 정비','C → B',12,'sp',null,5),
  ('skill:차량 정비:6:B → A','차량 정비','B → A',15,'sp',null,6),
  ('skill:절도:1:연습 → F','절도','연습 → F',4,'sp',null,1),
  ('skill:절도:2:F → E','절도','F → E',8,'sp',null,2),
  ('skill:절도:3:E → D','절도','E → D',10,'sp',null,3),
  ('skill:절도:4:D → C','절도','D → C',12,'sp',null,4),
  ('skill:목재 가공:1:연습 → F','목재 가공','연습 → F',5,'sp',null,1),
  ('skill:목재 가공:2:F → E','목재 가공','F → E',5,'sp',null,2),
  ('skill:목재 가공:3:E → D','목재 가공','E → D',7,'sp',null,3),
  ('skill:목재 가공:4:D → C','목재 가공','D → C',10,'sp',null,4),
  ('skill:재련:1:연습 → F','재련','연습 → F',5,'sp','CSV 표기: 제련',1),
  ('skill:재련:2:F → E','재련','F → E',5,'sp','CSV 표기: 제련',2),
  ('skill:재련:3:E → D','재련','E → D',7,'sp','CSV 표기: 제련',3),
  ('skill:재련:4:D → C','재련','D → C',10,'sp','CSV 표기: 제련',4),
  ('skill:제작:1:연습 → F','제작','연습 → F',5,'sp',null,1),
  ('skill:제작:2:F → E','제작','F → E',10,'sp',null,2),
  ('skill:제작:3:E → D','제작','E → D',15,'sp',null,3),
  ('skill:제작:4:D → C','제작','D → C',20,'sp',null,4),
  ('skill:요리:1:연습 → F','요리','연습 → F',5,'sp',null,1),
  ('skill:요리:2:F → E','요리','F → E',5,'sp',null,2),
  ('skill:요리:3:E → D','요리','E → D',7,'sp',null,3),
  ('skill:요리:4:D → C','요리','D → C',10,'sp',null,4),
  ('skill:요리:5:C → B','요리','C → B',15,'sp',null,5),
  ('skill:요리:6:B → A','요리','B → A',25,'sp',null,6),
  ('skill:감정:1:연습 → F','감정','연습 → F',4,'sp',null,1),
  ('skill:감정:2:F → E','감정','F → E',8,'sp',null,2),
  ('skill:감정:3:E → D','감정','E → D',12,'sp',null,3),
  ('skill:감정:4:D → C','감정','D → C',20,'sp',null,4),
  ('skill:전문가 치료(EMS):1:연습 → F','전문가 치료(EMS)','연습 → F',5,'sp',null,1),
  ('skill:전문가 치료(EMS):2:F → E','전문가 치료(EMS)','F → E',10,'sp',null,2),
  ('skill:전문가 치료(EMS):3:E → D','전문가 치료(EMS)','E → D',15,'sp',null,3),
  ('skill:전문가 치료(EMS):4:D → C','전문가 치료(EMS)','D → C',15,'sp',null,4),
  ('skill:몸 수색(경찰):1:연습 → F','몸 수색(경찰)','연습 → F',2,'sp',null,1),
  ('skill:몸 수색(경찰):2:F → E','몸 수색(경찰)','F → E',3,'sp',null,2),
  ('skill:몸 수색(경찰):3:E → D','몸 수색(경찰)','E → D',5,'sp',null,3),
  ('skill:몸 수색(경찰):4:D → C','몸 수색(경찰)','D → C',8,'sp',null,4),
  ('skill:전력질주:1:연습 → F','전력질주','연습 → F',5,'sp',null,1),
  ('skill:전력질주:2:F → E','전력질주','F → E',10,'sp',null,2),
  ('skill:전력질주:3:E → D','전력질주','E → D',15,'sp',null,3),
  ('skill:전력질주:4:D → C','전력질주','D → C',20,'sp',null,4),
  ('skill:체력:1:연습 → F','체력','연습 → F',2,'sp',null,1),
  ('skill:체력:2:F → E','체력','F → E',5,'sp',null,2),
  ('skill:체력:3:E → D','체력','E → D',10,'sp',null,3),
  ('skill:체력:4:D → C','체력','D → C',15,'sp',null,4),
  ('skill:체력:5:C → B','체력','C → B',20,'sp',null,5),
  ('skill:체력:6:B → A','체력','B → A',26,'sp',null,6),
  ('skill:컴뱃롤:1:연습 → F','컴뱃롤','연습 → F',2,'sp',null,1),
  ('skill:컴뱃롤:2:F → E','컴뱃롤','F → E',4,'sp',null,2),
  ('skill:컴뱃롤:3:E → D','컴뱃롤','E → D',6,'sp',null,3),
  ('skill:컴뱃롤:4:D → C','컴뱃롤','D → C',8,'sp',null,4),
  ('skill:컴뱃롤:5:C → B','컴뱃롤','C → B',10,'sp',null,5),
  ('skill:컴뱃롤:6:B → A','컴뱃롤','B → A',12,'sp',null,6),
  ('skill:돌진:1:연습 → F','돌진','연습 → F',4,'sp',null,1),
  ('skill:돌진:2:F → E','돌진','F → E',6,'sp',null,2),
  ('skill:돌진:3:E → D','돌진','E → D',8,'sp',null,3),
  ('skill:돌진:4:D → C','돌진','D → C',10,'sp',null,4),
  ('skill:돌진:5:C → B','돌진','C → B',12,'sp',null,5),
  ('skill:돌진:6:B → A','돌진','B → A',14,'sp',null,6),
  ('skill:돌진:7:A → 9','돌진','A → 9',50,'sp','수련서 5장 추가 필요',7),
  ('skill:운전:1:연습 → F','운전','연습 → F',10,'sp',null,1),
  ('skill:운전:2:F → E','운전','F → E',15,'sp',null,2),
  ('skill:운전:3:E → D','운전','E → D',20,'sp',null,3),
  ('skill:작곡:1:연습 → F','작곡','연습 → F',2,'sp',null,1),
  ('skill:작곡:2:F → E','작곡','F → E',3,'sp',null,2),
  ('skill:작곡:3:E → D','작곡','E → D',6,'sp',null,3),
  ('skill:작곡:4:D → C','작곡','D → C',10,'sp',null,4),
  ('skill:악기연주:1:연습 → F','악기연주','연습 → F',2,'sp',null,1),
  ('skill:악기연주:2:F → E','악기연주','F → E',4,'sp',null,2),
  ('skill:악기연주:3:E → D','악기연주','E → D',6,'sp',null,3),
  ('skill:악기연주:4:D → C','악기연주','D → C',8,'sp',null,4),
  ('skill:악기연주:5:C → B','악기연주','C → B',10,'sp',null,5),
  ('skill:악기연주:6:B → A','악기연주','B → A',12,'sp',null,6),
  ('skill:악기연주:7:A → 9','악기연주','A → 9',15,'sp',null,7),
  ('skill:피스톨 마스터리:1:연습 → F','피스톨 마스터리','연습 → F',5,'sp',null,1),
  ('skill:피스톨 마스터리:2:F → E','피스톨 마스터리','F → E',8,'sp',null,2),
  ('skill:피스톨 마스터리:3:E → D','피스톨 마스터리','E → D',12,'sp',null,3),
  ('skill:피스톨 마스터리:4:D → C','피스톨 마스터리','D → C',15,'sp',null,4),
  ('skill:SMG 마스터리:1:연습 → F','SMG 마스터리','연습 → F',5,'sp',null,1),
  ('skill:SMG 마스터리:2:F → E','SMG 마스터리','F → E',8,'sp',null,2),
  ('skill:SMG 마스터리:3:E → D','SMG 마스터리','E → D',12,'sp',null,3),
  ('skill:SMG 마스터리:4:D → C','SMG 마스터리','D → C',15,'sp',null,4)
on conflict (legacy_key) do update set
  skill = excluded.skill,
  rank = excluded.rank,
  required_point = excluded.required_point,
  point_type = excluded.point_type,
  note = excluded.note,
  sort_order = excluded.sort_order,
  updated_at = now();

commit;

notify pgrst, 'reload schema';

-- Verification: should return 123 confirmed transitions across 24 skills.
select count(*) as confirmed_transition_count,
       count(distinct skill) as skill_count
from new_axe_net.info_skill_ranks
where skill in ('벌목', '채광', '낚시', '보물찾기', '채집', '택배', '차량 정비', '절도', '목재 가공', '재련', '제작', '요리', '감정', '전문가 치료(EMS)', '몸 수색(경찰)', '전력질주', '체력', '컴뱃롤', '돌진', '운전', '작곡', '악기연주', '피스톨 마스터리', 'SMG 마스터리');

-- Spot-check the corrected/new values.
select skill, rank, required_point, point_type, note, sort_order
from new_axe_net.info_skill_ranks
where skill in ('채광','낚시','보물찾기','택배','운전','돌진','악기연주','재련')
order by skill, sort_order, id;
