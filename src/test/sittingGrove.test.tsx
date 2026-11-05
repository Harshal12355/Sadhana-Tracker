import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SittingGrove } from '../components/SittingGrove';

describe('SittingGrove', () => {
  it('shows living plants, stumps, and the count that only goes up', () => {
    const html = renderToStaticMarkup(
      <SittingGrove
        marks={[
          { id: 'grown-1', result: 'grown' },
          { id: 'dead-1', result: 'withered' },
        ]}
        livingCount={1}
      />
    );
    expect(html).toContain('Living plant');
    expect(html).toContain('Stump');
    expect(html).toContain('1 living plant');
  });
});
