import { NextResponse } from 'next/server';
import { requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { validationError } from '@/lib/errors';
import { convertFile } from '@/lib/import/convert';
import { createDocument } from '@/lib/services/documents';

/**
 * multipart/form-data with `file` (.txt, .md or .docx).
 * mode=new (default): creates a document owned by the caller and returns its id.
 * mode=content: only converts, so an open document can insert the content at the cursor.
 */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw validationError('Send the file as multipart/form-data.');
  }
  const file = form.get('file');
  if (!(file instanceof File)) throw validationError('Choose a file to import.');

  const imported = await convertFile(file.name, new Uint8Array(await file.arrayBuffer()));
  if (form.get('mode') === 'content') {
    return NextResponse.json({ title: imported.title, content: imported.content });
  }

  const document = await createDocument(await getDb(), user.id, {
    title: imported.title,
    content: imported.content,
    contentText: imported.text,
    versionLabel: `Imported from ${file.name}`,
  });
  return NextResponse.json({ document }, { status: 201 });
});
