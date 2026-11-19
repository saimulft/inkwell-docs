import { z } from 'zod';

export const TITLE_MAX_LENGTH = 120;
export const UNTITLED = 'Untitled document';

/** Empty titles fall back to "Untitled document", like Google Docs. */
export const titleSchema = z
  .string({ error: 'Title must be text.' })
  .trim()
  .max(TITLE_MAX_LENGTH, `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`)
  .transform((title) => title || UNTITLED);

export const shareRoleSchema = z.enum(['viewer', 'editor'], { error: 'Role must be "viewer" or "editor".' });

const emailSchema = z
  .string({ error: 'Enter an email address.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }));

export const loginSchema = z.object({ email: emailSchema });

export const createDocumentSchema = z.object({ title: titleSchema.optional() });

export const updateDocumentSchema = z
  .object({
    title: titleSchema.optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    baseVersion: z.number().int().positive().optional(),
  })
  .refine((body) => body.title !== undefined || body.content !== undefined, {
    error: 'Send a title or content to update.',
  })
  .refine((body) => body.content === undefined || body.baseVersion !== undefined, {
    error: 'baseVersion is required when saving content.',
    path: ['baseVersion'],
  });

export const shareSchema = z.object({ email: emailSchema, role: shareRoleSchema });
export const updateShareSchema = z.object({ role: shareRoleSchema });

export const documentFilterSchema = z.enum(['all', 'owned', 'shared']).catch('all');
export type DocumentFilter = z.infer<typeof documentFilterSchema>;

/** File import limits, shown in the UI and enforced on the server. */
// Vercel caps request bodies at 4.5 MB, so the limit stays safely below it.
export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;
export const IMPORT_EXTENSIONS = ['.txt', '.md', '.markdown', '.docx'] as const;
export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.join(',');
export const IMPORT_HELP_TEXT = '.txt, .md or .docx · up to 4 MB';
