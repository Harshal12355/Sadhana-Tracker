import { describe, expect, it } from 'vitest';
import { mantraTotal, stepBead } from '../beadCount';

describe('stepBead', () => {
  it('adds a round on the 108th bead and returns to 0', () => {
    expect(stepBead({ completedRounds: 3, beadsInRound: 107 }, 1)).toEqual({
      completedRounds: 4,
      beadsInRound: 0,
    });
  });

  it('counts a missing field as 0', () => {
    expect(stepBead({ completedRounds: 0 }, 1)).toEqual({
      completedRounds: 0,
      beadsInRound: 1,
    });
  });

  it('undoes the round boundary', () => {
    expect(stepBead({ completedRounds: 1, beadsInRound: 0 }, -1)).toEqual({
      completedRounds: 0,
      beadsInRound: 107,
    });
  });

  it('does not go below 0 beads when there is no round to undo', () => {
    expect(stepBead({ completedRounds: 0, beadsInRound: 0 }, -1)).toEqual({
      completedRounds: 0,
      beadsInRound: 0,
    });
  });

  it('does not raise rounds past 64', () => {
    expect(stepBead({ completedRounds: 64, beadsInRound: 107 }, 1)).toEqual({
      completedRounds: 64,
      beadsInRound: 0,
    });
  });

  it('clamps a wild bead count before stepping', () => {
    expect(stepBead({ completedRounds: 1, beadsInRound: 500 }, 1)).toEqual({
      completedRounds: 2,
      beadsInRound: 0,
    });
  });

  it('counts the partial round in the mantra total', () => {
    expect(mantraTotal(3, 37)).toBe(3 * 108 + 37);
    expect(mantraTotal(2)).toBe(216);
  });
});
