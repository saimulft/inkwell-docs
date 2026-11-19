import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { DocumentEditor } from '@/components/editor/document-editor';
import { getCurrentUser, toPublicUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { AppError } from '@/lib/errors';
import { getDocument } from '@/lib/services/documents';

const loadDocument = cache(async (userId: string, id: string) => {
  try {
    return await getDocument(await getDb(), userId, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps<'/documents/[id]'>): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const document = user ? await loadDocument(user.id, id) : null;
  return { title: document?.title ?? 'Document' };
}

export default async function DocumentPage({ params }: PageProps<'/documents/[id]'>) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/documents/${id}`)}`);
  const document = await loadDocument(user.id, id);
  if (!document) notFound();
  return <DocumentEditor key={document.id} user={toPublicUser(user)} initialDocument={document} />;
}
