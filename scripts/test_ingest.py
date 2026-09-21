import copy
import importlib.util
import json
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('ingest', Path(__file__).with_name('ingest-nflverse.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
BASE = dict(game_id='2025_01_DET_GB', play_id='1', season='2025', season_type='REG', week='1', game_date='2025-09-07', home_team='GB', away_team='DET', touchdown='1', td_team='DET', posteam='DET', play_type='pass', pass_touchdown='1', rush_touchdown='0', yardline_100='22', yards_gained='22', air_yards='-5', yards_after_catch='27', pass_location='left', qtr='2', time='00:31', desc='Original description.')

class IngestionTests(unittest.TestCase):
    def test_negative_air_is_not_clamped(self):
        p = m.normalize(BASE)
        self.assertEqual(p['geometry']['catchX'], 23)
        self.assertEqual(p['yardsAfterCatch'], 27)
        self.assertEqual(p['description'], BASE['desc'])
    def test_missing_inconsistent_or_nonfinite_segments_are_not_invented(self):
        for override in ({'air_yards': ''}, {'yards_after_catch': ''}, {'air_yards': 'NaN'}, {'air_yards': 'Infinity'}, {'air_yards': '99'}, {'yards_after_catch': '30'}):
            p = m.normalize(BASE | override)
            self.assertEqual(p['geometry']['segmentation'], 'unsegmented')
            self.assertIsNone(p['geometry']['catchX'])
    def test_zero_air_and_zero_yac_remain_distinct(self):
        for air, yac in [(0, 22), (22, 0)]:
            p = m.normalize(BASE | {'air_yards': str(air), 'yards_after_catch': str(yac)})
            self.assertEqual(p['geometry']['catchX'], 28 + air)
            self.assertEqual(p['geometry']['segmentation'], 'recorded')
    def test_missing_location_is_explicit(self):
        p = m.normalize(BASE | {'pass_location': ''})
        self.assertIsNone(p['location'])
    def test_los_fallback_is_documented(self):
        p = m.normalize(BASE | {'yardline_100': ''})
        self.assertEqual(p['geometry']['losSource'], 'yards_gained')
        self.assertEqual(p['geometry']['losX'], 28)
        p = m.normalize(BASE | {'yardline_100': '', 'yards_gained': ''})
        self.assertIsNone(p['geometry']['losX'])
    def test_filters_do_not_treat_returns_or_nullified_scores_as_offense(self):
        for override in ({'td_team':'GB'}, {'touchdown':'0','play_type':'no_play'}, {'play_type':'punt','return_touchdown':'1'}, {'posteam':'GB'}, {'pass_touchdown':'0','rush_touchdown':'0'}, {'two_point_attempt':'1'}, {'interception':'1'}):
            self.assertIsNotNone(m.exclusion_reason(BASE | override, 'DET'))
        self.assertIsNone(m.exclusion_reason(BASE | {'penalty':'1'}, 'DET')) # Between-downs penalty can coexist with valid TD.
    def test_real_dataset_accounting_and_longitudinal_invariants(self):
        data = json.loads((m.ROOT / 'public/data/2025/DET.json').read_text())
        plays = data['touchdowns']
        self.assertEqual(len(plays), 56)
        self.assertEqual(sum(p['type']=='pass' for p in plays), 35)
        self.assertEqual(sum(p['type']=='rush' for p in plays), 21)
        self.assertEqual(len({p['id'] for p in plays}), 56)
        for p in plays:
            self.assertEqual(p['geometry']['losX'], 50-p['yardline100'])
            self.assertEqual(p['yards'], p['yardline100'])
            if p['type']=='pass':
                self.assertEqual(p['geometry']['catchX']-p['geometry']['losX'], p['airYards'])
                self.assertEqual(50-p['geometry']['catchX'], p['yardsAfterCatch'])
        self.assertEqual(data['summary']['officialDetroitTDs'], len(plays)+data['summary']['excludedOfficialTDs'])

if __name__ == '__main__': unittest.main()
