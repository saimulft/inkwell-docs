import type { JSONContent } from '@tiptap/core';

/**
 * Serializes editor JSON to GitHub-flavoured Markdown for "Download as Markdown".
 * Underline and highlight have no Markdown syntax, so they become inline <u> and <mark>.
 */
export function toMarkdown(doc: JSONContent): string {
  return `${blocks(doc.content ?? []).trim()}\n`;
}

const blocks = (nodes: JSONContent[]) => nodes.map(block).join('\n\n');

function block(node: JSONContent): string {
  switch (node.type) {
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inline(node.content)}`;
    case 'paragraph':
      return inline(node.content);
    case 'bulletList':
      return list(node, () => '- ');
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return list(node, (index) => `${start + index}. `);
    }
    case 'taskList':
      return list(node, (_, item) => `- [${item.attrs?.checked ? 'x' : ' '}] `);
    case 'blockquote':
      return prefixLines(blocks(node.content ?? []), '> ');
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      return `\`\`\`${language}\n${(node.content ?? []).map((child) => child.text ?? '').join('')}\n\`\`\``;
    }
    case 'horizontalRule':
      return '---';
    default:
      return inline(node.content);
  }
}

function list(node: JSONContent, marker: (index: number, item: JSONContent) => string): string {
  return (node.content ?? [])
    .map((item, index) => {
      const prefix = marker(index, item);
      const [first, ...rest] = item.content ?? [];
      const head = prefix + (first ? block(first) : '');
      const nested = rest.map((child) => prefixLines(block(child), ' '.repeat(prefix.length)));
      return [head, ...nested].join('\n');
    })
    .join('\n');
}

const prefixLines = (text: string, prefix: string) =>
  text
    .split('\n')
    .map((line) => (line ? prefix + line : prefix.trimEnd()))
    .join('\n');

const escapeText = (text: string) => text.replace(/([\\`*_[\]<>#])/g, '\\$1');

function inline(nodes: JSONContent[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === 'hardBreak') return '  \n';
      if (node.type !== 'text') return '';
      const marks = new Map((node.marks ?? []).map((mark) => [mark.type, mark.attrs]));
      if (marks.has('code')) return `\`${node.text ?? ''}\``;
      let text = escapeText(node.text ?? '');
      if (marks.has('bold')) text = `**${text}**`;
      if (marks.has('italic')) text = `_${text}_`;
      if (marks.has('strike')) text = `~~${text}~~`;
      if (marks.has('underline')) text = `<u>${text}</u>`;
      if (marks.has('highlight')) text = `<mark>${text}</mark>`;
      const link = marks.get('link') as { href?: string } | undefined;
      if (link?.href) text = `[${text}](${link.href})`;
      return text;
    })
    .join('');
}

/** Turns a title into a safe download file name. */
export const fileNameFor = (title: string, extension: string) =>
  `${
    title
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'document'
  }.${extension}`;
