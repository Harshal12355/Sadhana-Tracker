import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VowLine } from '../components/VowLine';

describe('VowLine', () => {
  it('shows the rounds left and the two ways out', () => {
    const html = renderToStaticMarkup(
      <VowLine text="12 rounds are left" onStart={() => {}} onSkip={() => {}} />
    );
    expect(html).toContain('12 rounds are left');
    expect(html).toContain('Start a sitting');
    expect(html).toContain('Skip today');
  });
});
