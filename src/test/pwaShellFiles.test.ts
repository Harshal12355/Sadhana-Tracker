import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('pwa shell files', () => {
  it('tells iPhone to open as an app', () => {
    const html = readFileSync(resolve('index.html'), 'utf8');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Sadhana" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(html).toContain(
      'href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&f[]=satoshi@400,500,700&display=swap"\n      rel="stylesheet"\n      crossorigin'
    );
  });

  it('copies public icons into the image build', () => {
    const dockerfile = readFileSync(resolve('Dockerfile'), 'utf8');
    expect(dockerfile).toContain('COPY public ./public');
  });
});
