# Manual source-description verification

Reviewed five representative normalized records against the original rows in the downloaded nflverse 2025 CSV. All are official Detroit touchdowns, with `touchdown=1`, `td_team=DET`, and the matching pass/rush touchdown flag. The original descriptions are preserved verbatim in DET.json and the generated audit.

| Source game : play | Description check | Source fields and resulting X coordinates |
|---|---|---|
| 2025_02_CHI_DET : 3030 | Q3 6:28, Goff → Jameson Williams, **deep left, 44-yard TD**. Matches pass classification, scorer, total and left region. | `yardline_100=44`, `air_yards=42`, `yards_after_catch=2`. LOS **6** → catch **48** → score **50**. |
| 2025_13_GB_DET : 2028 | Q2 0:31, Goff → Jameson Williams, **short left, 22-yard TD**. Matches receiver, type, region and total. | LOS **28** → catch **23** → score **50**. **−5 air + 27 YAC = 22**. Negative air is retained, not clamped to zero. |
| 2025_12_NYG_DET : 1804 | Q2 2:21, Goff → Jahmyr Gibbs, **short right, 3-yard TD**. Matches type, scorer, total and region. | LOS **47** → catch **47** → score **50**. **0 air + 3 YAC = 3**. Zero air is valid, not missing. |
| 2025_07_TB_DET : 1556 | Q2 6:01, Jahmyr Gibbs **up the middle, 78-yard TD**. Matches scorer, rush classification, middle and 78-yard distance. | `yardline_100=78`, `yards_gained=78`, `run_location=middle`, `run_gap=null`. LOS **−28** → score **50**. No gap is claimed. |
| 2025_02_CHI_DET : 862 | Q1 2:45, David Montgomery **up the middle, 1-yard TD**. Matches scorer, type, distance and region. | LOS **49** → score **50**. A one-yard burst with bounded lateral movement, not a wide sideline sweep. |

Descriptions establish the scorer, play type, direction and total yards, but do **not** independently specify exact air/YAC splits. Those splits were checked against the numeric columns of the same source rows; this is source-consistency validation, not tracking/video validation.

Additional edge-case review:

- Week 1 play 3730 and Week 9 play 4151 retain replay-reversal prose. Their final source flags and final descriptions credit valid touchdowns; the earlier incomplete/short-of-goal wording does not incorrectly exclude them.
- Week 5 play 1227 is **David Montgomery passing to Brock Wright**, so passing TDs are not filtered by Jared Goff as passer.
- Week 10 play 1378 and Week 11 play 1719 include penalties enforced between downs; both touchdowns stand. A blanket `penalty=0` filter would be wrong.
- Week 4 play 3492 is Kalif Raymond's **65-yard punt return**, the sole official Detroit TD excluded by scope.
- Week 6 play 438 and Week 16 plays 4774/4913 are nullified by penalty with `touchdown=0`; they never enter the official count.

The dataset contains 17 Detroit regular-season games, no Detroit postseason games, 57 official Detroit TDs, 56 offensive TDs, and 1 return TD. All 56 offensive TDs have usable source LOS and yardage. All 35 passing records satisfy `air_yards + yards_after_catch = yards_gained = yardline_100`.
