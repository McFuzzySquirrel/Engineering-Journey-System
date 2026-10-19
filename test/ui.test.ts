// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderMarkdown } from '../src/ui/markdown.js';

function render(source: string): HTMLDivElement {
  const container = document.createElement('div');
  container.append(renderMarkdown(source));
  return container;
}

it('renders Markdown and protects external links', () => {
  const container = render(
    '## Decision\n\nReadable **Markdown** with [a local link](/records/ADR-1) and [an external link](https://example.com).',
  );

  expect(container.querySelector('h2')?.textContent).toBe('Decision');
  expect(container.querySelector('strong')?.textContent).toBe('Markdown');
  expect(
    container
      .querySelector<HTMLAnchorElement>('a[href="/records/ADR-1"]')
      ?.getAttribute('target'),
  ).toBeNull();
  expect(
    container.querySelector<HTMLAnchorElement>('a[href="https://example.com"]'),
  ).toMatchObject({
    target: '_blank',
    rel: 'noopener noreferrer',
  });
});

it('does not create active HTML, unsafe links, or remote embedded media', () => {
  const container = render(
    [
      '<script>alert(1)</script>',
      '<img src="https://example.com/raw.png" onerror="alert(1)">',
      '![tracking image](https://example.com/tracker.png)',
      '[unsafe link](javascript:alert%281%29)',
    ].join('\n\n'),
  );

  expect(
    container.querySelector('script, iframe, img, video, audio, object, embed'),
  ).toBeNull();
  expect(container.querySelector('[onerror], [style]')).toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(container.textContent).toContain('<script>alert(1)</script>');
});
