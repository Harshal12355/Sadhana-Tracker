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

export async function requestChantWakeLock(nav: {
  wakeLock?: { request: (type: 'screen') => Promise<unknown> };
}): Promise<boolean> {
  if (!nav.wakeLock) return false;
  try {
    await nav.wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}
