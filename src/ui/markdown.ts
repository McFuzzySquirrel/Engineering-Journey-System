import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

export function renderMarkdown(source: string): DocumentFragment {
  const rendered = document.createElement('template');
  rendered.innerHTML = DOMPurify.sanitize(markdown.render(source), {
    FORBID_ATTR: ['style'],
    FORBID_TAGS: [
      'audio',
      'embed',
      'iframe',
      'img',
      'math',
      'object',
      'svg',
      'video',
    ],
  });
  for (const link of rendered.content.querySelectorAll<HTMLAnchorElement>(
    'a[href]',
  )) {
    if (/^(?:https?:)?\/\//i.test(link.getAttribute('href') ?? '')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  }
  return rendered.content;
}
