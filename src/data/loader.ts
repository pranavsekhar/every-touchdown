import type { SeasonData } from './types';
export type Catalog = { scope: string; seasons: Record<string, Record<string, SeasonData['summary']>> };
export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch('/data/index.json');
  if (!response.ok) throw new Error('The season archive could not be loaded.');
  return response.json();
}
export async function loadSeason(team: string, season: number, signal?: AbortSignal): Promise<SeasonData> {
  const response = await fetch(`/data/${season}/${team}.json`, {signal});
  if (!response.ok) throw new Error('This season could not be loaded. Please try again.');
  const data: SeasonData = await response.json();
  if (data.schemaVersion !== 1 || data.team !== team || data.season !== season || !Array.isArray(data.touchdowns) || data.touchdowns.length !== data.summary.total || data.touchdowns.some(p => p.team !== team || p.season !== season)) throw new Error('The season dataset is invalid.');
  return data;
}
