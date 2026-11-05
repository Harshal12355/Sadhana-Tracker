export const BEADS_PER_ROUND = 108;
export const MAX_ROUNDS = 64;

export function clampBeads(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(BEADS_PER_ROUND - 1, Math.max(0, Math.floor(value)));
}

export function stepBead(
  state: { completedRounds: number; beadsInRound?: number },
  delta: 1 | -1
): { completedRounds: number; beadsInRound: number } {
  const rounds = state.completedRounds;
  const beads = clampBeads(state.beadsInRound);

  if (delta === 1) {
    if (beads >= BEADS_PER_ROUND - 1) {
      return {
        completedRounds: Math.min(MAX_ROUNDS, rounds + 1),
        beadsInRound: 0,
      };
    }
    return { completedRounds: rounds, beadsInRound: beads + 1 };
  }

  if (beads === 0 && rounds >= 1) {
    return { completedRounds: rounds - 1, beadsInRound: BEADS_PER_ROUND - 1 };
  }

  return { completedRounds: rounds, beadsInRound: Math.max(0, beads - 1) };
}

export function mantraTotal(completedRounds: number, beadsInRound?: number): number {
  return completedRounds * BEADS_PER_ROUND + clampBeads(beadsInRound);
}
