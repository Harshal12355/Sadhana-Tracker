import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rules = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../firestore.rules'),
  'utf8'
);

describe('firestore day rules', () => {
  it('allows a bead count from 0 to 107 on a day record', () => {
    expect(rules).toContain("'beadsInRound'");
    expect(rules).toContain('data.beadsInRound is int');
    expect(rules).toContain('data.beadsInRound >= 0');
    expect(rules).toContain('data.beadsInRound <= 107');
  });

  it('allows a sitting list on a day record', () => {
    expect(rules).toContain("'sittings'");
    expect(rules).toContain('in-progress');
    expect(rules).toContain('grown');
    expect(rules).toContain('withered');
  });
});
