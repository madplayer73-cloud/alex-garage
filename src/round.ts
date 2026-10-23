export const MAX_SPINS = 3;

export type GameMode = 'chance' | 'hold';

export type RoundState = {
  mode: GameMode;
  attempts: number;
  reels: number[];
  held: boolean[];
  done: boolean;
};

export function newRound(mode: GameMode = 'chance'): RoundState {
  return { mode, attempts: 0, reels: [-1, -1, -1], held: [false, false, false], done: false };
}

function uniformIndex(length: number): number {
  const numbers = new Uint32Array(1);
  const limit = Math.floor(2 ** 32 / length) * length;
  do { crypto.getRandomValues(numbers); } while (numbers[0] >= limit);
  return numbers[0] % length;
}

export function winningChoice(round: RoundState): number | null {
  return round.attempts > 0 && round.reels.every(index => index === round.reels[0]) ? round.reels[0] : null;
}

export function canHold(round: RoundState, reel: number): boolean {
  if (round.mode !== 'hold' || !Number.isInteger(reel) || reel < 0 || reel > 2 || round.attempts === 0 || round.done) return false;
  const existing = round.held.findIndex(Boolean);
  return existing === -1 || round.held[reel] || round.reels[existing] === round.reels[reel];
}

export function toggleHold(round: RoundState, reel: number): RoundState {
  if (!canHold(round, reel)) return round;
  return { ...round, held: round.held.map((held, index) => index === reel ? !held : held) };
}

export function spinRound(round: RoundState, choiceCount: number, pick = uniformIndex): RoundState {
  if (round.done || round.attempts >= MAX_SPINS) throw new Error('Táto dilema už má svoj verdikt.');
  if (!Number.isInteger(choiceCount) || choiceCount < 2 || choiceCount > 5) throw new Error('Pridaj 2 až 5 možností.');
  const draw = () => {
    const index = pick(choiceCount);
    if (!Number.isInteger(index) || index < 0 || index >= choiceCount) throw new Error('Neplatný náhodný výber.');
    return index;
  };
  const attempts = round.attempts + 1;
  const held = round.mode === 'hold' ? round.held : [false, false, false];
  const heldReel = held.findIndex(Boolean);
  // A decision helper must finish. Real slot machines do not guarantee this.
  const finalChoice = attempts === MAX_SPINS ? (heldReel === -1 ? draw() : round.reels[heldReel]) : null;
  const reels = round.reels.map((index, reel) => held[reel] ? index : (finalChoice ?? draw()));
  const next = { mode: round.mode, attempts, reels, held: [...held], done: false };
  next.done = winningChoice(next) !== null;
  return next;
}

export function restoreRound(value: unknown, choiceCount: number): RoundState {
  if (!value || typeof value !== 'object') return newRound();
  const round = value as RoundState;
  // Preserve older in-progress games, whose rules always allowed holds.
  const mode = round.mode === undefined ? 'hold' : round.mode;
  if (mode !== 'chance' && mode !== 'hold') return newRound();
  if (!Number.isInteger(round.attempts) || round.attempts < 0 || round.attempts > MAX_SPINS ||
      !Array.isArray(round.reels) || round.reels.length !== 3 ||
      !Array.isArray(round.held) || round.held.length !== 3 ||
      !round.held.every(held => typeof held === 'boolean') || typeof round.done !== 'boolean') return newRound();
  if (round.attempts === 0) return newRound(mode);
  if (!round.reels.every(index => Number.isInteger(index) && index >= 0 && index < choiceCount)) return newRound();
  const heldChoices = round.reels.filter((_, index) => round.held[index]);
  if ((mode === 'chance' && heldChoices.length > 0) || new Set(heldChoices).size > 1 || round.done !== (winningChoice(round) !== null) ||
      (round.attempts === MAX_SPINS && !round.done)) return newRound();
  return { mode, attempts: round.attempts, reels: [...round.reels], held: [...round.held], done: round.done };
}
