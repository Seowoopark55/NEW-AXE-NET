# Skill Rank Update · 2026-08-27

Source: user-provided `스킬포인트 필요량 - 스킬포인트 요구량.csv`.

## Coverage
- 24 skills
- 123 confirmed rank transitions
- `-` and `현재 없음` are intentionally not stored as transitions.

## Important corrections from previous data
- 채광 B → A: 15SP → **14SP**
- 낚시 B → A: 14SP → **15SP**
- 보물찾기 F → E: 6SP → **4SP**
- 보물찾기 E → D: 8SP → **6SP**
- 택배 E → D: 8SP → **6SP**
- 택배 D → C: 10SP → **9SP**
- 운전 F → E: 20SP → **15SP**
- 운전 E → D: 30SP → **20SP**
- 돌진 A → 9: **50SP + 수련서 5장**
- 벌목/채광 D → C: 10SP confirmed; old recheck note removed.

## New / completed data
- 작곡 added.
- 악기연주 added through A → 9; obsolete `아이언 주` rows removed.
- 피스톨 마스터리 / SMG 마스터리 confirmed through D → C.
- Previously missing transitions for 채집, 차량 정비, 목재 가공, 체력, 전력질주, 몸 수색(경찰), etc. are filled.

## Compatibility
The existing canonical skill name `재련` is retained in the database to avoid breaking existing references. The source CSV calls it `제련`, which is retained in row notes.
