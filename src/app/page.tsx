import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DocumentsHome } from '@/components/home/documents-home';
import { getCurrentUser, toPublicUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { listDocuments } from '@/lib/services/documents';

export const metadata: Metadata = { title: 'Documents' };

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const documents = await listDocuments(await getDb(), user.id, 'all');
  return <DocumentsHome user={toPublicUser(user)} initialDocuments={documents} />;
}
