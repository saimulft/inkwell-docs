import type { JSONContent } from '@tiptap/core';
import { generateJSON } from '@tiptap/html/server';
import mammoth from 'mammoth';
import { Marked } from 'marked';
import { parseDocumentContent } from '@/lib/editor/content';
import { schemaExtensions } from '@/lib/editor/extensions';
import { payloadTooLarge, unsupportedMediaType, validationError } from '@/lib/errors';
import { IMPORT_EXTENSIONS, IMPORT_MAX_BYTES, TITLE_MAX_LENGTH, UNTITLED } from '@/lib/validation';

export type ImportedDocument = { title: string; content: JSONContent; text: string };

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Raw HTML inside Markdown is shown as text, never interpreted.
const markdown = new Marked({ gfm: true, renderer: { html: ({ text }) => escapeHtml(text) } });

/**
 * Turns an uploaded .txt, .md or .docx file into editor JSON.
 * Every format goes file -> HTML -> the editor's own schema, so unsupported markup is dropped
 * and the result is exactly what the editor can display and save.
 */
export async function convertFile(name: string, bytes: Uint8Array): Promise<ImportedDocument> {
  const extension = extensionOf(name);
  if (!(IMPORT_EXTENSIONS as readonly string[]).includes(extension)) {
    throw unsupportedMediaType(`${extension || 'This'} files aren’t supported. Upload a .txt, .md or .docx file.`);
  }
  if (bytes.byteLength === 0) throw validationError('That file is empty.');
  if (bytes.byteLength > IMPORT_MAX_BYTES) throw payloadTooLarge('Files must be 4 MB or smaller.');

  let html: string;
  if (extension === '.docx') {
    html = await docxToHtml(bytes);
  } else {
    const text = decodeText(bytes);
    html = extension === '.txt' ? textToHtml(text) : await markdown.parse(text);
  }

  const { content, text } = parseDocumentContent(generateJSON(html, schemaExtensions));
  return { title: leadingHeading(content) ?? titleFromFilename(name), content, text };
}

function extensionOf(name: string): string {
  const match = /\.[^.]+$/.exec(name.toLowerCase());
  return match ? match[0] : '';
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    throw validationError('That file isn’t valid UTF-8 text.');
  }
}

/** Blank lines separate paragraphs; single line breaks are kept inside a paragraph. */
function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function docxToHtml(bytes: Uint8Array): Promise<string> {
  // A .docx is a zip archive: reject anything that doesn't start with the zip signature.
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw validationError('That file isn’t a valid .docx document.');
  try {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) }, { styleMap: ['u => u', 'strike => s'] });
    return result.value;
  } catch {
    throw validationError('We couldn’t read that .docx file. Is it password-protected or corrupted?');
  }
}

/** A document that opens with a level-1 heading is titled by it, like most Markdown and Word files intend. */
function leadingHeading(content: JSONContent): string | null {
  const first = content.content?.[0];
  if (first?.type !== 'heading' || first.attrs?.level !== 1) return null;
  const text = textOf(first).trim();
  return text ? text.slice(0, TITLE_MAX_LENGTH) : null;
}

const textOf = (node: JSONContent): string => (node.text ?? '') + (node.content ?? []).map(textOf).join('');

function titleFromFilename(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim();
  return (base || UNTITLED).slice(0, TITLE_MAX_LENGTH);
}
