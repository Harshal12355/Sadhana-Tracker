import { describe, expect, it, vi } from 'vitest';
import {
  isVolumeUpKey,
  releaseChantWakeLock,
  requestChantWakeLock,
  shouldIgnoreKeyRepeat,
  spaceAction,
  volumeButtonsAvailable,
  volumeSwitchAfter,
} from '../chantInput';

describe('spaceAction', () => {
  it('counts a bead while the chant screen is open', () => {
    expect(spaceAction(true, 'BODY')).toBe('bead');
  });

  it('counts a round when the chant screen is closed', () => {
    expect(spaceAction(false, 'BODY')).toBe('round');
  });

  it('counts a bead on the chant screen even when a button is focused', () => {
    expect(spaceAction(true, 'BUTTON')).toBe('bead');
    expect(spaceAction(true, 'INPUT')).toBe('bead');
  });

  it('ignores space in a text field or on a button when the chant screen is closed', () => {
    expect(spaceAction(false, 'INPUT')).toBe('ignore');
    expect(spaceAction(false, 'TEXTAREA')).toBe('ignore');
    expect(spaceAction(false, 'SELECT')).toBe('ignore');
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

  it('arms the switch until volume up arrives, then counts the next press', () => {
    expect(volumeSwitchAfter('off', 'toggle-on')).toEqual({ state: 'armed', countBead: false });
    expect(volumeSwitchAfter('armed', 'volume-up')).toEqual({ state: 'on', countBead: false });
    expect(volumeSwitchAfter('on', 'volume-up')).toEqual({ state: 'on', countBead: true });
    expect(volumeSwitchAfter('off', 'volume-up')).toEqual({ state: 'off', countBead: false });
    expect(volumeSwitchAfter('on', 'toggle-off')).toEqual({ state: 'off', countBead: false });
  });

  it('ignores a key that is still held down', () => {
    expect(shouldIgnoreKeyRepeat({ repeat: true })).toBe(true);
    expect(shouldIgnoreKeyRepeat({ repeat: false })).toBe(false);
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

  it('releases the screen lock it asked for', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    await requestChantWakeLock({ wakeLock: { request } });
    await releaseChantWakeLock();
    expect(release).toHaveBeenCalledOnce();
  });
});
