import { describe, expect, it, vi } from 'vitest';
import {
  isVolumeUpKey,
  requestChantWakeLock,
  spaceAction,
  volumeButtonsAvailable,
} from '../chantInput';

describe('spaceAction', () => {
  it('counts a bead while the chant screen is open', () => {
    expect(spaceAction(true, 'BODY')).toBe('bead');
  });

  it('counts a round when the chant screen is closed', () => {
    expect(spaceAction(false, 'BODY')).toBe('round');
  });

  it('ignores space in a text field or on a button', () => {
    expect(spaceAction(true, 'INPUT')).toBe('ignore');
    expect(spaceAction(true, 'TEXTAREA')).toBe('ignore');
    expect(spaceAction(true, 'SELECT')).toBe('ignore');
    expect(spaceAction(false, 'BUTTON')).toBe('ignore');
  });
});

describe('volume keys', () => {
  it('counts only volume up', () => {
    expect(isVolumeUpKey({ key: 'VolumeUp', code: '' })).toBe(true);
    expect(isVolumeUpKey({ key: 'AudioVolumeUp', code: '' })).toBe(true);
    expect(isVolumeUpKey({ key: '', code: 'VolumeUp' })).toBe(true);
    expect(isVolumeUpKey({ key: 'VolumeDown', code: 'VolumeDown' })).toBe(false);
    expect(isVolumeUpKey({ key: 'AudioVolumeDown', code: '' })).toBe(false);
  });

  it('hides volume buttons on iPhone and iPad', () => {
    expect(volumeButtonsAvailable({ userAgent: 'iPhone', maxTouchPoints: 5 })).toBe(false);
    expect(volumeButtonsAvailable({ userAgent: 'iPad', maxTouchPoints: 5 })).toBe(false);
    expect(
      volumeButtonsAvailable({ userAgent: 'Macintosh', maxTouchPoints: 5 })
    ).toBe(false);
    expect(
      volumeButtonsAvailable({ userAgent: 'Macintosh', maxTouchPoints: 0 })
    ).toBe(true);
    expect(volumeButtonsAvailable({ userAgent: 'Android', maxTouchPoints: 5 })).toBe(true);
  });
});

describe('requestChantWakeLock', () => {
  it('asks for a screen lock and still returns when the phone refuses', async () => {
    const request = vi.fn().mockResolvedValue({});
    await expect(requestChantWakeLock({ wakeLock: { request } })).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith('screen');
    await expect(requestChantWakeLock({})).resolves.toBe(false);
    await expect(
      requestChantWakeLock({ wakeLock: { request: vi.fn().mockRejectedValue(new Error('no')) } })
    ).resolves.toBe(false);
  });
});
