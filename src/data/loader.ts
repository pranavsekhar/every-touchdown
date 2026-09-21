import type { SeasonData } from './types';
export async function loadSeason(): Promise<SeasonData> {
  const response = await fetch('/data/2025/DET.json');
  if (!response.ok) throw new Error(`Season data unavailable (${response.status})`);
  const data: SeasonData = await response.json();
  if (data.schemaVersion !== 1 || data.team !== 'DET' || data.season !== 2025 || !Array.isArray(data.touchdowns) || data.touchdowns.length !== data.summary.total) {
    throw new Error('Season dataset is invalid');
  }
  return data;
}
