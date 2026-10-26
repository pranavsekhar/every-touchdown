import type { Touchdown } from './types.js';
export type TouchdownFilter = 'all' | 'pass' | 'rush';
export function filterTouchdowns(plays: Touchdown[], filter: TouchdownFilter) {
 return plays.filter(play=>filter==='all'||play.type===filter);
}
