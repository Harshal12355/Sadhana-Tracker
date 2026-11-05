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
});
