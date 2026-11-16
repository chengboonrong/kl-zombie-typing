// Typing-based pace: how fast zombies walk and spawn, and how big waves get.
// levelIndex is the index into LEVELS (0-10).

export const typingSpeed = (levelIndex: number) => 0.4 + 0.2 * levelIndex;   // letters/s a typical student manages
export const paceMul = (wave: number) => Math.min(1.6, 1 + 0.08 * (wave - 1));

export function walkTime(wordLen: number, levelIndex: number, wave: number, runner: boolean): number {
  const t = (3 + 2 * wordLen / typingSpeed(levelIndex)) / paceMul(wave);
  return runner ? t * 0.6 : t;
}

export function spawnInterval(avgLen: number, levelIndex: number, wave: number): number {
  return Math.max(0.8, avgLen / typingSpeed(levelIndex)) / paceMul(wave);
}

export const waveSize = (wave: number) => 3 + 2 * wave;
export const runnerShare = (wave: number) => wave < 4 ? 0 : Math.min(0.3, 0.1 * (wave - 3));
