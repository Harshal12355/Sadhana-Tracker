import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BeadChantScreen } from '../components/BeadChantScreen';

const noop = () => {};

describe('BeadChantScreen', () => {
  it('shows the bead count and a page-sized tap', () => {
    const html = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={37}
        completedRounds={3}
        volumeAllowed
        volumeOn={false}
        volumeArmed={false}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(html).toContain('37 / 108');
    expect(html).toContain('One bead');
    expect(html).toContain('Back one bead');
    expect(html).toContain('Done');
    expect(html).toContain('3 rounds today');
    expect(html).toContain('Volume up counts');
  });

  it('keeps the volume switch off when the phone will not allow it', () => {
    const html = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={0}
        completedRounds={0}
        volumeAllowed={false}
        volumeOn={false}
        volumeArmed={false}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(html).toContain('This phone will not hand over the volume buttons.');
    expect(html).toContain('disabled');
  });

  it('asks for one volume press before the switch counts', () => {
    const html = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={0}
        completedRounds={0}
        volumeAllowed
        volumeOn={false}
        volumeArmed
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(html).toContain('Press volume up once.');
  });

  it('offers a sitting length before one has started', () => {
    const html = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={0}
        completedRounds={0}
        volumeAllowed
        volumeOn={false}
        volumeArmed={false}
        sitting={null}
        onStartSitting={noop}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(html).toContain('Start a sitting');
    expect(html).toContain('10 minutes');
    expect(html).toContain('20 minutes');
    expect(html).toContain('30 minutes');
  });

  it('shows the sprout and does not offer a second start', () => {
    const seed = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={1}
        completedRounds={0}
        volumeAllowed
        volumeOn={false}
        volumeArmed={false}
        sitting={{ id: 'sit-1', minutes: 20, result: 'in-progress' }}
        onStartSitting={noop}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(seed).toContain('Living tree');
    expect(seed).not.toContain('Seed');
    expect(seed).not.toContain('Start a sitting');
    const sprout = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={1}
        completedRounds={0}
        volumeAllowed
        volumeOn={false}
        volumeArmed={false}
        sitting={{ id: 'sit-1', minutes: 20, result: 'in-progress' }}
        onStartSitting={noop}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(sprout).toContain('Living tree');
  });

  it('says when the sprout was planted and hides a new start after 20 sittings', () => {
    const planted = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={0}
        completedRounds={0}
        volumeAllowed
        volumeOn={false}
        volumeArmed={false}
        sitting={null}
        sittingNote="Planted"
        canStartSitting
        onStartSitting={noop}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(planted).toContain('Planted');
    expect(planted).toContain('Living tree');
    const full = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={0}
        completedRounds={0}
        volumeAllowed
        volumeOn={false}
        volumeArmed={false}
        sitting={null}
        sittingNote="This sprout withered"
        canStartSitting={false}
        onStartSitting={noop}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(full).toContain('This sprout withered');
    expect(full).toContain('Bare branches');
    expect(full).not.toContain('Start a sitting');
  });
});
