export type Location = 'left' | 'middle' | 'right';
export type Touchdown = {
  id: string; playId: string; gameId: string; team: string; opponent: string;
  homeAway?: 'home' | 'away'; season: number; seasonType: 'REG' | 'POST'; week: number; gameDate: string;
  type: 'pass' | 'rush'; passer: string | null; passerId: string | null; scorer: string | null; scorerId: string | null;
  startYardline: number | null; yardline100: number | null; yards: number | null;
  airYards: number | null; yardsAfterCatch: number | null; location: Location | null;
  runLocation: Location | null; runGap: 'guard' | 'tackle' | 'end' | null;
  quarter: number; clock: string; down: number | null; yardsToGo: number | null; description: string;
  geometry: { losX: number | null; catchX: number | null; endX: number; losSource: string | null; segmentation: 'recorded' | 'unsegmented' | 'not-applicable' };
  dataFlags: string[];
};
export type SeasonData = {
  schemaVersion: number; team: string; season: number; seasonTypes: string[];
  source: { provider: string; url: string; sha256: string; scope: string };
  summary: { total: number; passing: number; rushing: number; games: number };
  touchdowns: Touchdown[];
};
