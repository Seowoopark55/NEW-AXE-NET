-- AXE NET v1.45.1
-- Skill-rank point refresh · 2026-08-26
--
-- Source: user-provided in-game skill-rank table screenshot.
-- Policy:
--   1) Confirmed numeric cells are upserted.
--   2) Blank cells do NOT delete or overwrite older values.
--   3) Red 10SP?? cells are stored as 10SP with a recheck note.
--   4) A → 9 book requirements are stored in note.
--   5) '제련' in the screenshot is kept under existing canonical skill name '재련'.
--
begin;

insert into new_axe_net.info_skill_ranks
  (legacy_key, skill, rank, required_point, point_type, note, sort_order)
values
('skill:벌목:1:연습 → F','벌목','연습 → F',2,'sp',null,1),
('skill:벌목:2:F → E','벌목','F → E',3,'sp',null,2),
('skill:벌목:3:E → D','벌목','E → D',6,'sp',null,3),
('skill:벌목:4:D → C','벌목','D → C',10,'sp','10SP 추정 · 재확인 필요',4),
('skill:벌목:5:C → B','벌목','C → B',12,'sp',null,5),
('skill:벌목:6:B → A','벌목','B → A',14,'sp',null,6),
('skill:벌목:7:A → 9','벌목','A → 9',45,'sp','수련서 3장 추가 필요',7),
('skill:택배:1:연습 → F','택배','연습 → F',2,'sp',null,1),
('skill:택배:2:F → E','택배','F → E',4,'sp',null,2),
('skill:택배:7:A → 9','택배','A → 9',45,'sp','수련서 3장 추가 필요',7),
('skill:체력:3:E → D','체력','E → D',10,'sp',null,3),
('skill:체력:5:C → B','체력','C → B',20,'sp',null,5),
('skill:체력:6:B → A','체력','B → A',26,'sp',null,6),
('skill:낚시:1:연습 → F','낚시','연습 → F',2,'sp',null,1),
('skill:낚시:2:F → E','낚시','F → E',3,'sp',null,2),
('skill:낚시:3:E → D','낚시','E → D',6,'sp',null,3),
('skill:낚시:5:C → B','낚시','C → B',12,'sp',null,5),
('skill:낚시:6:B → A','낚시','B → A',14,'sp',null,6),
('skill:낚시:7:A → 9','낚시','A → 9',45,'sp','수련서 3장 추가 필요',7),
('skill:채집:1:연습 → F','채집','연습 → F',2,'sp',null,1),
('skill:보물찾기:1:연습 → F','보물찾기','연습 → F',2,'sp',null,1),
('skill:보물찾기:4:D → C','보물찾기','D → C',9,'sp',null,4),
('skill:보물찾기:5:C → B','보물찾기','C → B',12,'sp',null,5),
('skill:보물찾기:6:B → A','보물찾기','B → A',15,'sp',null,6),
('skill:감정:1:연습 → F','감정','연습 → F',4,'sp',null,1),
('skill:감정:2:F → E','감정','F → E',8,'sp',null,2),
('skill:감정:3:E → D','감정','E → D',12,'sp',null,3),
('skill:감정:4:D → C','감정','D → C',20,'sp',null,4),
('skill:아이언 주:1:연습 → F','아이언 주','연습 → F',2,'sp',null,1),
('skill:아이언 주:2:F → E','아이언 주','F → E',4,'sp',null,2),
('skill:아이언 주:3:E → D','아이언 주','E → D',6,'sp',null,3),
('skill:아이언 주:4:D → C','아이언 주','D → C',8,'sp',null,4),
('skill:아이언 주:5:C → B','아이언 주','C → B',10,'sp',null,5),
('skill:아이언 주:6:B → A','아이언 주','B → A',12,'sp',null,6),
('skill:아이언 주:7:A → 9','아이언 주','A → 9',15,'sp',null,7),
('skill:차량 정비:1:연습 → F','차량 정비','연습 → F',2,'sp',null,1),
('skill:차량 정비:3:E → D','차량 정비','E → D',6,'sp',null,3),
('skill:차량 정비:5:C → B','차량 정비','C → B',12,'sp',null,5),
('skill:차량 정비:6:B → A','차량 정비','B → A',15,'sp',null,6),
('skill:목재 가공:2:F → E','목재 가공','F → E',5,'sp',null,2),
('skill:목재 가공:4:D → C','목재 가공','D → C',10,'sp',null,4),
('skill:재련:1:연습 → F','재련','연습 → F',5,'sp','이미지 표기: 제련',1),
('skill:재련:3:E → D','재련','E → D',7,'sp','이미지 표기: 제련',3),
('skill:재련:4:D → C','재련','D → C',10,'sp','이미지 표기: 제련',4),
('skill:전력질주:3:E → D','전력질주','E → D',15,'sp',null,3),
('skill:전문가 치료(EMS):1:연습 → F','전문가 치료(EMS)','연습 → F',5,'sp',null,1),
('skill:전문가 치료(EMS):2:F → E','전문가 치료(EMS)','F → E',10,'sp',null,2),
('skill:전문가 치료(EMS):3:E → D','전문가 치료(EMS)','E → D',15,'sp',null,3),
('skill:전문가 치료(EMS):4:D → C','전문가 치료(EMS)','D → C',15,'sp',null,4),
('skill:몸 수색(경찰):1:연습 → F','몸 수색(경찰)','연습 → F',2,'sp',null,1),
('skill:몸 수색(경찰):2:F → E','몸 수색(경찰)','F → E',3,'sp',null,2),
('skill:제작:2:F → E','제작','F → E',10,'sp',null,2),
('skill:요리:1:연습 → F','요리','연습 → F',5,'sp',null,1),
('skill:요리:2:F → E','요리','F → E',5,'sp',null,2),
('skill:요리:3:E → D','요리','E → D',7,'sp',null,3),
('skill:요리:4:D → C','요리','D → C',10,'sp',null,4),
('skill:요리:5:C → B','요리','C → B',15,'sp',null,5),
('skill:컴뱃롤:4:D → C','컴뱃롤','D → C',8,'sp',null,4),
('skill:컴뱃롤:5:C → B','컴뱃롤','C → B',10,'sp',null,5),
('skill:컴뱃롤:6:B → A','컴뱃롤','B → A',12,'sp',null,6),
('skill:돌진:1:연습 → F','돌진','연습 → F',4,'sp',null,1),
('skill:돌진:2:F → E','돌진','F → E',6,'sp',null,2),
('skill:돌진:3:E → D','돌진','E → D',8,'sp',null,3),
('skill:돌진:4:D → C','돌진','D → C',10,'sp',null,4),
('skill:돌진:5:C → B','돌진','C → B',12,'sp',null,5),
('skill:돌진:6:B → A','돌진','B → A',14,'sp',null,6),
('skill:돌진:7:A → 9','돌진','A → 9',50,'sp','수련서 3장 추가 필요',7),
('skill:절도:1:연습 → F','절도','연습 → F',4,'sp',null,1),
('skill:절도:2:F → E','절도','F → E',8,'sp',null,2),
('skill:절도:3:E → D','절도','E → D',10,'sp',null,3),
('skill:절도:4:D → C','절도','D → C',12,'sp',null,4),
('skill:운전:1:연습 → F','운전','연습 → F',10,'sp',null,1),
('skill:운전:2:F → E','운전','F → E',20,'sp',null,2),
('skill:운전:3:E → D','운전','E → D',30,'sp',null,3),
('skill:채광:1:연습 → F','채광','연습 → F',2,'sp',null,1),
('skill:채광:2:F → E','채광','F → E',3,'sp',null,2),
('skill:채광:3:E → D','채광','E → D',6,'sp',null,3),
('skill:채광:4:D → C','채광','D → C',10,'sp','10SP 추정 · 재확인 필요',4),
('skill:채광:5:C → B','채광','C → B',12,'sp',null,5),
('skill:채광:7:A → 9','채광','A → 9',45,'sp','수련서 3장 추가 필요',7)
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

-- Quick verification
select skill, rank, required_point, point_type, note, sort_order
from new_axe_net.info_skill_ranks
where skill in (
  '벌목','택배','체력','낚시','채집','보물찾기','감정','아이언 주',
  '차량 정비','목재 가공','재련','전력질주','전문가 치료(EMS)',
  '몸 수색(경찰)','제작','요리','컴뱃롤','돌진','절도','운전','채광'
)
order by skill, sort_order, id;
