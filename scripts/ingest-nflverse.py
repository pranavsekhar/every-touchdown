#!/usr/bin/env python3
"""Download/normalize nflverse PBP with Python's standard library. No backend required."""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
from collections import Counter
from pathlib import Path
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parents[1]
LOCATIONS = {'left', 'middle', 'right'}
GAPS = {'guard', 'tackle', 'end'}

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
               'officialDetroitTDs': sum(r.get('td_team') == team for r in official),
               'excludedOfficialTDs': len(excluded), 'nullifiedScoringAttempts': len(nullified),
               'missingAirYacLocation': len(missing), 'missingRunGap': sum(p['runGap'] is None for p in rushes),
               'negativeAirYards': sum(p['airYards'] is not None and p['airYards'] < 0 for p in passes),
               'unsegmentedPasses': sum(p['geometry']['segmentation'] == 'unsegmented' for p in passes),
               'unrenderablePlays': sum(p['geometry']['losX'] is None for p in plays)}
    selectors = [max(passes, key=lambda p: p['yards'] or 0), min(passes, key=lambda p: p['airYards'] if p['airYards'] is not None else 999),
                 next((p for p in passes if p['airYards'] == 0), passes[0]), max(rushes, key=lambda p: p['yards'] or 0), min(rushes, key=lambda p: p['yards'] or 0)]
    report = {'source': source, 'summary': summary, 'gameIds': games, 'excluded': excluded, 'nullified': nullified, 'missing': missing,
              'missingRunGap': [{'id': p['id'], 'runLocation': p['runLocation']} for p in rushes if p['runGap'] is None],
              'flagged': [{'id': p['id'], 'flags': p['dataFlags']} for p in plays if p['dataFlags']],
              'negativeAirYards': [p['id'] for p in passes if p['airYards'] is not None and p['airYards'] < 0],
              'byWeek': dict(sorted(Counter(p['week'] for p in plays).items())), 'representativeTouchdowns': selectors}
    dataset = {'schemaVersion': 1, 'team': team, 'season': season, 'seasonTypes': sorted({p['seasonType'] for p in plays}), 'source': source, 'summary': summary, 'touchdowns': plays}
    return dataset, report

def markdown(report):
    s = report['summary']
    lines = ['# Detroit 2025 — ingestion audit', '', f"Source: [nflverse 2025 PBP]({report['source']['url']}).", '',
        f"- **{s['total']} offensive TDs: {s['passing']} passing, {s['rushing']} rushing**, across {s['games']} games.",
        f"- {s['officialDetroitTDs']} official Detroit TDs; {s['excludedOfficialTDs']} excluded return TD.",
        f"- {s['nullifiedScoringAttempts']} nullified scoring attempts separately rejected (not part of official TD total).",
        f"- {s['missingAirYacLocation']} plays missing air/YAC/location; {s['unsegmentedPasses']} passing fallbacks; {s['unrenderablePlays']} unrenderable plays.",
        f"- {s['missingRunGap']} rushes lack run_gap (all are recorded as middle); no gap is invented.",
        f"- {s['negativeAirYards']} negative-air-yard passes retained with catches behind LOS.", '',
        '## Exclusions', '']
    for p in report['excluded'] + report['nullified']:
        lines += [f"- `{p['id']}` — {p['reason']}", f"  {p['description']}"]
    lines += ['', '## Normalized representative plays', '', 'X is yards, with the scoring goal line at +50. Air/YAC are signed longitudinal distances, not curved path lengths. Scoring stops at the goal-line plane; no end-zone depth is invented.', '']
    for p in report['representativeTouchdowns']:
        lines += [f"### Week {p['week']} · {p['scorer']} · {p['yards']:g}-yard {p['type']}", '', '```json', json.dumps(p, indent=2), '```', '']
    lines += ['## Provenance', '', f"Compressed source SHA-256: `{report['source']['sha256']}`", '', 'The full machine-readable audit is DET-2025.audit.json. Re-run ingestion to regenerate both reports. Manual description checks are documented separately in manual-verification.md.']
    return '\n'.join(lines) + '\n'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, help='Existing nflverse .csv or .csv.gz; otherwise download/cache release')
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    season, team = 2025, 'DET'
    url = f'https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.csv.gz'
    path = args.input or ROOT / 'work' / 'nflverse' / f'play_by_play_{season}.csv.gz'
    if args.input is None and (args.refresh or not path.exists()):
        path.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(Request(url, headers={'User-Agent': 'EveryTouchdown/0.2'}), timeout=90) as response:
            raw = response.read()
        gzip.decompress(raw) # Do not cache a bad download.
        path.write_bytes(raw)
    raw = path.read_bytes()
    source = {'provider': 'nflverse / nflfastR', 'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'format': 'csv.gz' if path.suffix == '.gz' else 'csv', 'scope': '2025 REG + POST (Detroit has REG games only)', 'dictionary': 'https://nflreadr.nflverse.com/articles/dictionary_pbp.html'}
    text = gzip.decompress(raw).decode('utf-8-sig') if path.suffix == '.gz' else raw.decode('utf-8-sig')
    dataset, report = build(csv.DictReader(io.StringIO(text)), team, season, source)
    destination = ROOT / 'public' / 'data' / str(season) / f'{team}.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    audit = ROOT / 'validation'; audit.mkdir(exist_ok=True)
    (audit / 'DET-2025.audit.json').write_text(json.dumps(report, indent=2) + '\n')
    (audit / 'DET-2025.md').write_text(markdown(report))
    if dataset['summary']['unrenderablePlays']:
        raise ValueError('Missing LOS: audit written, but incomplete season not published')
    destination.write_text(json.dumps(dataset, separators=(',', ':')) + '\n')
    print(json.dumps(report['summary'], indent=2))
    print(f'Wrote {destination} ({destination.stat().st_size:,} bytes)')

if __name__ == '__main__': main()
