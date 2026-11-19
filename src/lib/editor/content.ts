import { getSchema, type JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { validationError, payloadTooLarge } from '@/lib/errors';
import { schemaExtensions } from './extensions';

export const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

let cachedSchema: Schema | undefined;
export function documentSchema(): Schema {
  cachedSchema ??= getSchema(schemaExtensions);
  return cachedSchema;
}

export const emptyDocument = (): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph' }] });

/**
 * Parses untrusted editor JSON against the document schema.
 * Throws a 422 for anything the editor could not have produced (unknown nodes, bad nesting).
 */
export function parseDocumentContent(input: unknown): { content: JSONContent; text: string } {
  const size = JSON.stringify(input ?? null).length;
  if (size > MAX_CONTENT_BYTES) throw payloadTooLarge('This document is too large to save (limit is 2 MB).');

  let node: ProseMirrorNode;
  try {
    node = documentSchema().nodeFromJSON(input);
    node.check();
  } catch (error) {
    throw validationError('The document content is not valid.', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  if (node.type.name !== 'doc') throw validationError('The document content must start with a "doc" node.');

  return { content: node.toJSON() as JSONContent, text: plainText(node) };
}

function plainText(node: ProseMirrorNode): string {
  return node
    .textBetween(0, node.content.size, '\n', ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
