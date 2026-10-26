#!/usr/bin/env python3
"""Download/normalize nflverse PBP with Python's standard library. No backend required."""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from pathlib import Path
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parents[1]
LOCATIONS = {'left', 'middle', 'right'}
GAPS = {'guard', 'tackle', 'end'}
ALIASES = {'OAK': 'LV', 'SD': 'LAC', 'STL': 'LA', 'JAC': 'JAX'}
def canonical(team): return ALIASES.get(team, team)

def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None

def flag(row, key):
    return number(row.get(key)) == 1

def exclusion_reason(row, team):
    if not flag(row, 'touchdown'):
        return 'Not an official touchdown (nullified/no-play)'
    if row.get('td_team') != team:
        return 'Touchdown credited to the opponent'
    if row.get('play_type') in ('punt', 'kickoff', 'field_goal', 'extra_point') or flag(row, 'return_touchdown') or flag(row, 'own_kickoff_recovery_td'):
        return 'Special-teams/return touchdown (' + row.get('play_type', 'unknown') + ')'
    if row.get('posteam') != team or flag(row, 'interception'):
        return 'Defensive touchdown'
    if row.get('play_type') == 'no_play':
        return 'Nullified/no-play'
    if flag(row, 'two_point_attempt') or flag(row, 'extra_point_attempt'):
        return 'Conversion attempt, not a touchdown'
    if flag(row, 'pass_touchdown') and row.get('play_type') == 'pass':
        return None
    if flag(row, 'rush_touchdown') and row.get('play_type') == 'run':
        return None
    return 'Other touchdown (including fumble recovery), not a passing/rushing TD'

def normalize(row):
    kind = 'pass' if flag(row, 'pass_touchdown') else 'rush'
    distance, yards = number(row.get('yardline_100')), number(row.get('yards_gained'))
    flags = []
    los_source = 'yardline_100'
    if distance is None or not 0 < distance <= 100:
        distance = yards if yards is not None and 0 < yards <= 100 else None
        los_source = 'yards_gained' if distance is not None else None
        flags.append('LOS derived from touchdown yards' if distance is not None else 'No usable LOS')
    air, yac = number(row.get('air_yards')), number(row.get('yards_after_catch'))
    location = row.get('pass_location') if kind == 'pass' else row.get('run_location')
    location = location if location in LOCATIONS else None
    gap = row.get('run_gap') if row.get('run_gap') in GAPS else None
    los_x = 50 - distance if distance is not None else None
    segmentation = 'not-applicable'
    catch_x = None
    if kind == 'pass':
        segmentation = 'unsegmented'
        if air is None or yac is None:
            flags.append('Missing air yards or YAC: no inferred catch point')
        elif los_x is not None and -60 <= los_x + air <= 60 and math.isclose(air + yac, distance, abs_tol=0.01) and (yards is None or math.isclose(yards, distance, abs_tol=0.01)):
            segmentation, catch_x = 'recorded', los_x + air
        else:
            flags.append('Inconsistent/out-of-field air/YAC: no inferred catch point')
    if location is None:
        flags.append('Missing/unknown lateral region: seeded placement across field')
    if yards is None or (distance is not None and not math.isclose(yards, distance, abs_tol=0.01)):
        flags.append('Missing/inconsistent total yards; source LOS retained')
    return {
        'id': row['game_id'] + ':' + row['play_id'], 'playId': row['play_id'], 'gameId': row['game_id'],
        'homeAway': 'home' if row['home_team'] == row['td_team'] else 'away',
        'team': row['td_team'], 'opponent': row['away_team'] if row['home_team'] == row['td_team'] else row['home_team'],
        'season': int(row['season']), 'seasonType': row['season_type'], 'week': int(row['week']), 'gameDate': row['game_date'],
        'type': kind, 'passer': row.get('passer_player_name') or None, 'passerId': row.get('passer_player_id') or None,
        'scorer': row.get('td_player_name') or None, 'scorerId': row.get('td_player_id') or None,
        'startYardline': 100 - distance if distance is not None else None, 'yardline100': number(row.get('yardline_100')),
        'yards': yards, 'airYards': air if kind == 'pass' else None, 'yardsAfterCatch': yac if kind == 'pass' else None,
        'location': location, 'runLocation': location if kind == 'rush' else None, 'runGap': gap if kind == 'rush' else None,
        'quarter': int(row['qtr']), 'clock': row['time'], 'down': number(row.get('down')), 'yardsToGo': number(row.get('ydstogo')),
        'description': row['desc'],
        'geometry': {'losX': los_x, 'catchX': catch_x, 'endX': 50, 'losSource': los_source, 'segmentation': segmentation},
        'dataFlags': flags,
    }

def build(rows, team, season, source):
    rows = [r for r in rows if number(r.get('season')) == season and r.get('season_type') in ('REG', 'POST')]
    games = sorted({r['game_id'] for r in rows if team in (r.get('home_team'), r.get('away_team'))})
    official = [r for r in rows if flag(r, 'touchdown') and (r.get('td_team') == team or r.get('posteam') == team)]
    excluded, plays = [], []
    for row in official:
        reason = exclusion_reason(row, team)
        if reason:
            excluded.append({'id': row['game_id'] + ':' + row['play_id'], 'scoringTeam': row.get('td_team'), 'reason': reason, 'description': row['desc']})
        else:
            plays.append(normalize(row))
    plays.sort(key=lambda p: (p['week'], p['gameId'], float(p['playId'])))
    if len({p['id'] for p in plays}) != len(plays):
        raise ValueError('Duplicate source game/play ID; refusing to publish duplicate paths')
    if not plays:
        raise ValueError('No offensive touchdowns found; refusing to overwrite data')
    nullified = [{'id': r['game_id'] + ':' + r['play_id'], 'reason': 'Source touchdown=0; nullified by penalty', 'description': r['desc']} for r in rows if r.get('posteam') == team and not flag(r, 'touchdown') and 'TOUCHDOWN' in r.get('desc', '')]
    passes = [p for p in plays if p['type'] == 'pass']
    rushes = [p for p in plays if p['type'] == 'rush']
    missing = []
    for p in plays:
        fields = (['airYards', 'yardsAfterCatch', 'location'] if p['type'] == 'pass' else ['runLocation'])
        absent = [k for k in fields if p[k] is None]
        if absent: missing.append({'id': p['id'], 'fields': absent})
    summary = {'total': len(plays), 'passing': len(passes), 'rushing': len(rushes), 'games': len(games),
               'officialTeamTDs': sum(r.get('td_team') == team for r in official),
               'excludedOfficialTDs': len(excluded), 'nullifiedScoringAttempts': len(nullified),
               'missingAirYacLocation': len(missing), 'missingRunGap': sum(p['runGap'] is None for p in rushes),
               'negativeAirYards': sum(p['airYards'] is not None and p['airYards'] < 0 for p in passes),
               'unsegmentedPasses': sum(p['geometry']['segmentation'] == 'unsegmented' for p in passes),
               'unrenderablePlays': sum(p['geometry']['losX'] is None for p in plays)}
    selectors = []
    if passes: selectors += [max(passes, key=lambda p: p['yards'] or 0), min(passes, key=lambda p: p['airYards'] if p['airYards'] is not None else 999)]
    if rushes: selectors += [max(rushes, key=lambda p: p['yards'] or 0), min(rushes, key=lambda p: p['yards'] or 0)]
    report = {'team': team, 'season': season, 'source': source, 'summary': summary, 'gameIds': games, 'excluded': excluded, 'nullified': nullified, 'missing': missing,
              'missingRunGap': [{'id': p['id'], 'runLocation': p['runLocation']} for p in rushes if p['runGap'] is None],
              'flagged': [{'id': p['id'], 'flags': p['dataFlags']} for p in plays if p['dataFlags']],
              'negativeAirYards': [p['id'] for p in passes if p['airYards'] is not None and p['airYards'] < 0],
              'byWeek': dict(sorted(Counter(p['week'] for p in plays).items())), 'representativeTouchdowns': selectors}
    dataset = {'schemaVersion': 1, 'team': team, 'season': season, 'seasonTypes': sorted({p['seasonType'] for p in plays}), 'source': source, 'summary': summary, 'touchdowns': plays}
    return dataset, report

def generate(season, args):
    url = f'https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.csv.gz'
    path = args.input or ROOT / 'work' / 'nflverse' / f'play_by_play_{season}.csv.gz'
    if args.input is None and (args.refresh or not path.exists()):
        path.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(Request(url, headers={'User-Agent': 'EveryTouchdown/1.0'}), timeout=180) as response:
            raw = response.read()
        gzip.decompress(raw)
        path.write_bytes(raw)
    source = {'provider': 'nflverse / nflfastR', 'url': url, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'format': 'csv.gz' if path.suffix == '.gz' else 'csv', 'scope': f'{season} REG + POST', 'dictionary': 'https://nflreadr.nflverse.com/articles/dictionary_pbp.html'}
    rows, games, teams = [], set(), set()
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt', encoding='utf-8-sig', newline='') as stream:
        for row in csv.DictReader(stream):
            if row.get('season_type') not in ('REG', 'POST'): continue
            for key in ('home_team', 'away_team', 'posteam', 'td_team'):
                row[key] = canonical(row.get(key))
            teams.update([row['home_team'], row['away_team']])
            # Retain game accounting and scoring candidates, not an entire season's wide table.
            if row['game_id'] not in games or flag(row, 'touchdown') or 'TOUCHDOWN' in row.get('desc', ''):
                rows.append(row)
            games.add(row['game_id'])
    destination = ROOT / ('public/data' if 2016 <= season <= 2025 else 'work/historical-data') / str(season)
    destination.mkdir(parents=True, exist_ok=True)
    audit = ROOT / 'work' / 'audits' / str(season); audit.mkdir(parents=True, exist_ok=True)
    result = {}
    for team in sorted(teams):
        if not team or (args.team != 'ALL' and team != canonical(args.team)): continue
        dataset, report = build(rows, team, season, source)
        (audit / f'{team}.json').write_text(json.dumps(report, indent=2)+'\n')
        if dataset['summary']['unrenderablePlays']:
            raise ValueError(f'{team}/{season}: missing LOS; refusing incomplete season')
        (destination / f'{team}.json').write_text(json.dumps(dataset,separators=(',',':'))+'\n')
        result[team] = dataset['summary']
    print(f'{season}: {len(result)} teams / {sum(v["total"] for v in result.values())} offensive touchdowns', flush=True)
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--seasons', default='2025', help='Inclusive range, e.g. 2016:2025, or comma-separated years')
    parser.add_argument('--team', default='ALL')
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    seasons = list(range(int(args.seasons.split(':')[0]),int(args.seasons.split(':')[1])+1)) if ':' in args.seasons else [int(s) for s in args.seasons.split(',')]
    if args.input and len(seasons) != 1: parser.error('--input requires one season')
    if any(s < 1999 or s > 2025 for s in seasons): parser.error('Supported completed seasons: 1999–2025')
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(lambda season: generate(season,args), seasons))
    # Availability comes only from validated artifacts, never from a promised year range.
    manifest = {'schemaVersion': 1, 'scope': 'Regular season + postseason', 'seasons': {}}
    for path in sorted((ROOT / 'public/data').glob('*/*.json')):
        d = json.loads(path.read_text())
        if not 2016 <= d['season'] <= 2025: continue
        manifest['seasons'].setdefault(str(d['season']), {})[d['team']] = {k:d['summary'][k] for k in ('total','passing','rushing','games')}
    (ROOT / 'public/data/index.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')

if __name__ == '__main__': main()
