export function spaceAction(
  chantOpen: boolean,
  tagName: string
): 'bead' | 'round' | 'ignore' {
  const tag = tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') {
    return 'ignore';
  }
  return chantOpen ? 'bead' : 'round';
}

export function isVolumeUpKey(event: { key: string; code: string }): boolean {
  return (
    event.key === 'VolumeUp' ||
    event.key === 'AudioVolumeUp' ||
    event.code === 'VolumeUp' ||
    event.code === 'AudioVolumeUp'
  );
}

export function volumeButtonsAvailable(env: {
  userAgent: string;
  maxTouchPoints: number;
}): boolean {
  const ua = env.userAgent;
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) return false;
  if (ua.includes('Macintosh') && env.maxTouchPoints > 1) return false;
  return true;
}

type WakeSentinel = { release?: () => Promise<void> };

let heldWakeLock: WakeSentinel | null = null;

export async function requestChantWakeLock(nav: {
  wakeLock?: { request: (type: 'screen') => Promise<unknown> };
}): Promise<boolean> {
  if (!nav.wakeLock) return false;
  try {
    const sentinel = (await nav.wakeLock.request('screen')) as WakeSentinel;
    const previous = heldWakeLock;
    heldWakeLock = sentinel;
    if (previous && previous !== sentinel && typeof previous.release === 'function') {
      void previous.release().catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export async function releaseChantWakeLock(): Promise<void> {
  const current = heldWakeLock;
  heldWakeLock = null;
  if (typeof current?.release !== 'function') return;
  try {
    await current.release();
  } catch {
    // The phone may sleep. The bead button still counts.
  }
}
