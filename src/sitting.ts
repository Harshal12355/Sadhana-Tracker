export const HIDE_GRACE_MS = 5000;

export type Sitting = {
  id: string;
  minutes: 10 | 20 | 30;
  result: 'in-progress' | 'grown' | 'withered';
};

export function settleSitting(state: {
  result: Sitting['result'];
  elapsedMs: number;
  lengthMinutes: Sitting['minutes'];
  hiddenMs: number;
  endedEarly: boolean;
}): Sitting['result'] {
  if (state.result === 'grown' || state.result === 'withered') return state.result;
  if (state.endedEarly || state.hiddenMs > HIDE_GRACE_MS) return 'withered';
  if (state.elapsedMs >= state.lengthMinutes * 60_000) return 'grown';
  return 'in-progress';
}

export function sittingsAfterLoad(sittings: Sitting[] | undefined): Sitting[] {
  return (sittings ?? []).map((sitting) =>
    sitting.result === 'in-progress' ? { ...sitting, result: 'withered' } : sitting
  );
}

export function applySitting<
  T extends { sittings?: Sitting[]; completedRounds: number; beadsInRound?: number },
>(record: T, sitting: Sitting): T {
  const current = record.sittings ?? [];
  const exists = current.some((item) => item.id === sitting.id);
  const sittings = exists
    ? current.map((item) => (item.id === sitting.id ? sitting : item))
    : [...current, sitting];
  return { ...record, sittings };
}

export function groveView(
  days: { date: string; sittings?: Sitting[] }[],
  month: string
): { marks: { id: string; result: 'grown' | 'withered' }[]; livingCount: number } {
  const marks: { id: string; result: 'grown' | 'withered' }[] = [];
  let livingCount = 0;
  for (const day of days) {
    for (const sitting of day.sittings ?? []) {
      if (sitting.result === 'in-progress') continue;
      if (sitting.result === 'grown') livingCount += 1;
      if (day.date.startsWith(month)) marks.push({ id: sitting.id, result: sitting.result });
    }
  }
  return { marks, livingCount };
}

export function vowLine(input: {
  completedRounds: number;
  targetRounds: number;
  skippedDate: string | null;
  today: string;
  sittingStartedThisVisit: boolean;
}): { show: boolean; roundsLeft: number; text: string } {
  const roundsLeft = Math.max(0, input.targetRounds - input.completedRounds);
  const show =
    input.completedRounds < input.targetRounds &&
    input.skippedDate !== input.today &&
    !input.sittingStartedThisVisit;
  return { show, roundsLeft, text: `${roundsLeft} rounds are left` };
}

function mergeResult(a: Sitting['result'], b: Sitting['result']): Sitting['result'] {
  if (a === 'withered' || b === 'withered') return 'withered';
  if (a === 'grown' || b === 'grown') return 'grown';
  return 'in-progress';
}

export function mergeSittingLists(
  a: Sitting[] | undefined,
  b: Sitting[] | undefined
): Sitting[] | undefined {
  if (a === undefined && b === undefined) return undefined;
  const byId = new Map<string, Sitting>();
  for (const sitting of [...(a ?? []), ...(b ?? [])]) {
    const previous = byId.get(sitting.id);
    byId.set(
      sitting.id,
      previous ? { ...sitting, result: mergeResult(previous.result, sitting.result) } : sitting
    );
  }
  return [...byId.values()];
}
