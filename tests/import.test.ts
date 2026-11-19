import type { JSONContent } from '@tiptap/core';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { convertFile } from '@/lib/import/convert';

const encode = (text: string) => new TextEncoder().encode(text);
const types = (doc: JSONContent) => (doc.content ?? []).map((node) => node.type);
const marksIn = (node: JSONContent): string[] => [
  ...(node.marks ?? []).map((mark) => mark.type),
  ...(node.content ?? []).flatMap(marksIn),
];

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(status);
}

describe('file import', () => {
  it('turns Markdown into structured, formatted content', async () => {
    const markdown = [
      '# Launch plan',
      '',
      'We ship **on Friday** with _care_.',
      '',
      '## Steps',
      '',
      '- Write docs',
      '- Record demo',
      '',
      '1. First',
      '2. Second',
    ].join('\n');
    const result = await convertFile('plan.md', encode(markdown));

    expect(result.title).toBe('Launch plan');
    expect(types(result.content)).toEqual(['heading', 'paragraph', 'heading', 'bulletList', 'orderedList']);
    expect(result.content.content?.[0].attrs?.level).toBe(1);
    expect(marksIn(result.content)).toEqual(expect.arrayContaining(['bold', 'italic']));
    expect(result.text).toContain('Record demo');
  });

  it('shows raw HTML in Markdown as text instead of interpreting it', async () => {
    const result = await convertFile('note.md', encode('Hello <script>alert(1)</script> <b>bold?</b>'));
    expect(marksIn(result.content)).not.toContain('bold');
    expect(result.text).toContain('<script>alert(1)</script>');
  });

  it('turns plain text into paragraphs and keeps line breaks', async () => {
    const result = await convertFile('meeting_notes.txt', encode('Line one\nLine two\n\nSecond paragraph'));
    expect(result.title).toBe('meeting notes');
    expect(types(result.content)).toEqual(['paragraph', 'paragraph']);
    expect(result.content.content?.[0].content?.map((node) => node.type)).toEqual(['text', 'hardBreak', 'text']);
  });

  it('imports Word documents with headings and inline formatting', async () => {
    const docx = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: 'Quarterly review', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Bold', bold: true }),
                new TextRun(' then '),
                new TextRun({ text: 'italic', italics: true }),
                new TextRun(' then '),
                new TextRun({ text: 'underlined', underline: {} }),
              ],
            }),
          ],
        },
      ],
    });
    const bytes = new Uint8Array(await Packer.toBuffer(docx));
    const result = await convertFile('review.docx', bytes);

    expect(result.title).toBe('Quarterly review');
    expect(types(result.content)).toEqual(['heading', 'paragraph']);
    expect(marksIn(result.content)).toEqual(expect.arrayContaining(['bold', 'italic', 'underline']));
  });

  it('rejects unsupported, empty, oversized and fake files', async () => {
    await expectStatus(convertFile('report.pdf', encode('%PDF')), 415);
    await expectStatus(convertFile('empty.txt', new Uint8Array()), 422);
    await expectStatus(convertFile('big.txt', new Uint8Array(4 * 1024 * 1024 + 1).fill(97)), 413);
    await expectStatus(convertFile('fake.docx', encode('not a zip')), 422);
    await expectStatus(convertFile('binary.txt', new Uint8Array([0xff, 0xfe, 0xfd])), 422);
  });
});
