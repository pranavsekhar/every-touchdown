import type { Touchdown } from '../data/types.js';

const clockSeconds = (clock: string) => {
  const [m, s] = clock.split(':').map(Number);
  return Number.isFinite(m + s) ? m * 60 + s : 0;
};
export function chronological(plays: Touchdown[]) {
  return [...plays].sort((a, b) => a.week - b.week || a.gameDate.localeCompare(b.gameDate) || a.gameId.localeCompare(b.gameId) || a.quarter - b.quarter || clockSeconds(b.clock) - clockSeconds(a.clock) || Number(a.playId) - Number(b.playId) || a.id.localeCompare(b.id));
}
export type Cue = { play: Touchdown; start: number; drawEnd: number; end: number; catchAt: number };
export function buildTimeline(plays: Touchdown[]) {
  const ordered = chronological(plays);
  const weights = ordered.map(p => 0.29 + Math.sqrt(Math.max(0, p.yards ?? 0)) * 0.053 + (p.type === 'pass' ? 0.09 : 0));
  const opening = 1.2, ending = 1.5, settle = 0.19;
  const gaps: number[] = ordered.map((p, i) => i === ordered.length - 1 ? 0 : ordered[i + 1].gameId !== p.gameId ? 0.29 : 0.045);
  const scale = (Math.max(12, 2.7 + ordered.length * (37.3 / 56)) - opening - ending - settle * ordered.length - gaps.reduce((a, b) => a + b, 0)) / weights.reduce((a, b) => a + b, 0);
  let cursor = opening;
  const cues: Cue[] = ordered.map((play, i) => {
    const duration = weights[i] * scale;
    // Signed air yards remain in the geometry; timing uses distance travelled.
    const recorded = play.geometry.segmentation === 'recorded';
    const air = Math.abs(play.airYards ?? 0), yac = recorded ? Math.abs(play.yardsAfterCatch ?? 0) : 0;
    const catchAt = play.type === 'pass' ? (yac > 0 ? Math.max(0.32, Math.min(0.8, air / (air + yac || 1))) : 1) : 0;
    const cue = { play, start: cursor, drawEnd: cursor + duration, end: cursor + duration + settle, catchAt };
    cursor = cue.end + gaps[i]; return cue;
  });
  return { cues, opening, duration: cursor + ending };
}
export type Timeline = ReturnType<typeof buildTimeline>;
export function cueState(cue: Cue, time: number) {
  const progress = Math.max(0, Math.min(1, (time - cue.start) / (cue.drawEnd - cue.start)));
  const settle = Math.max(0, Math.min(1, (time - cue.drawEnd) / (cue.end - cue.drawEnd)));
  return { progress, emphasis: time < cue.start || time >= cue.end ? 0 : 1 - settle, pulse: time >= cue.drawEnd && time < cue.end ? Math.sin(Math.PI * settle) : 0 };
}
