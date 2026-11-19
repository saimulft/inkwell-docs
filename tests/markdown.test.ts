import { generateJSON } from '@tiptap/html/server';
import { describe, expect, it } from 'vitest';
import { schemaExtensions } from '@/lib/editor/extensions';
import { fileNameFor, toMarkdown } from '@/lib/editor/markdown';

describe('Markdown export', () => {
  it('keeps structure and formatting', () => {
    const doc = generateJSON(
      `<h1>Plan</h1>
       <p><strong>Bold</strong>, <em>italic</em>, <u>underlined</u> and <a href="https://example.com">a link</a>.</p>
       <ul><li><p>One</p><ul><li><p>Nested</p></li></ul></li><li><p>Two</p></li></ul>
       <ol><li><p>First</p></li><li><p>Second</p></li></ol>
       <ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li></ul>
       <blockquote><p>Quote</p></blockquote>`,
      schemaExtensions,
    );
    expect(toMarkdown(doc)).toBe(
      [
        '# Plan',
        '',
        '**Bold**, _italic_, <u>underlined</u> and [a link](https://example.com).',
        '',
        '- One',
        '  - Nested',
        '- Two',
        '',
        '1. First',
        '2. Second',
        '',
        '- [x] Done',
        '',
        '> Quote',
        '',
      ].join('\n'),
    );
  });

  it('escapes Markdown syntax typed as text', () => {
    const doc = generateJSON('<p>2 * 3 = 6 and use_snake_case</p>', schemaExtensions);
    expect(toMarkdown(doc)).toBe('2 \\* 3 = 6 and use\\_snake\\_case\n');
  });

  it('builds safe file names', () => {
    expect(fileNameFor('Q4 Product Roadmap!', 'md')).toBe('q4-product-roadmap.md');
    expect(fileNameFor('???', 'md')).toBe('document.md');
  });
});
