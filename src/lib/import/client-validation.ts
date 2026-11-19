import { IMPORT_EXTENSIONS, IMPORT_MAX_BYTES } from '@/lib/validation';

/** Fast client-side check before uploading; the server repeats every check. */
export function validateImportFile(file: File): string | null {
  const extension = /\.[^.]+$/.exec(file.name.toLowerCase())?.[0] ?? '';
  if (!(IMPORT_EXTENSIONS as readonly string[]).includes(extension)) {
    return `“${file.name}” isn’t supported. Upload a .txt, .md or .docx file.`;
  }
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > IMPORT_MAX_BYTES) return `“${file.name}” is larger than 4 MB.`;
  return null;
}
