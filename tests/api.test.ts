import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';
import * as login from '@/app/api/auth/login/route';
import * as documentAccess from '@/app/api/documents/[id]/access/route';
import * as documentRoute from '@/app/api/documents/[id]/route';
import * as documentsRoute from '@/app/api/documents/route';
import * as importRoute from '@/app/api/import/route';
import { ALICE, createTestDb, paragraphDoc } from './helpers';

const BASE = 'http://inkwell.test';

function request(
  path: string,
  init: { method?: string; json?: unknown; body?: BodyInit; cookie?: string; origin?: string } = {},
) {
  const headers = new Headers({ host: 'inkwell.test' });
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.origin) headers.set('origin', init.origin);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(new URL(path, BASE), {
    method: init.method ?? 'GET',
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

async function signIn(email: string): Promise<string> {
  const response = await login.POST(request('/api/auth/login', { method: 'POST', json: { email } }), undefined);
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie') ?? '';
  expect(cookie).toMatch(/inkwell_session=.+HttpOnly/i);
  return cookie.split(';')[0];
}

describe('API routes', () => {
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    globalThis.__inkwellDb = createTestDb();
    alice = await signIn('alice@example.com');
    bob = await signIn('bob@example.com');
  });

  it('requires a session', async () => {
    const response = await documentsRoute.GET(request('/api/documents'), undefined);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('rejects unknown demo accounts and malformed input with 422', async () => {
    const unknown = await login.POST(
      request('/api/auth/login', { method: 'POST', json: { email: 'x@example.com' } }),
      undefined,
    );
    expect(unknown.status).toBe(422);
    const malformed = await login.POST(
      request('/api/auth/login', { method: 'POST', json: { email: 'not-an-email' } }),
      undefined,
    );
    expect(malformed.status).toBe(422);
  });

  it('blocks cross-site writes', async () => {
    const response = await documentsRoute.POST(
      request('/api/documents', { method: 'POST', json: {}, cookie: alice, origin: 'https://evil.example' }),
      undefined,
    );
    expect(response.status).toBe(403);
  });

  it('creates, shares, saves and protects a document end to end', async () => {
    const created = await documentsRoute.POST(
      request('/api/documents', { method: 'POST', json: { title: '  ' }, cookie: alice }),
      undefined,
    );
    expect(created.status).toBe(201);
    const { document } = (await created.json()) as { document: { id: string } };

    const opened = await documentRoute.GET(
      request(`/api/documents/${document.id}`, { cookie: alice }),
      params({ id: document.id }),
    );
    const detail = (await opened.json()) as { document: { title: string; version: number; role: string } };
    expect(detail.document).toMatchObject({ title: 'Untitled document', version: 1, role: 'owner' });

    // A stranger can't tell the document exists.
    const hidden = await documentRoute.GET(
      request(`/api/documents/${document.id}`, { cookie: bob }),
      params({ id: document.id }),
    );
    expect(hidden.status).toBe(404);

    const shared = await documentAccess.POST(
      request(`/api/documents/${document.id}/access`, {
        method: 'POST',
        json: { email: 'BOB@example.com ', role: 'editor' },
        cookie: alice,
      }),
      params({ id: document.id }),
    );
    expect(shared.status).toBe(201);

    const save = (cookie: string, baseVersion: number, text: string) =>
      documentRoute.PATCH(
        request(`/api/documents/${document.id}`, {
          method: 'PATCH',
          json: { content: paragraphDoc(text), baseVersion },
          cookie,
        }),
        params({ id: document.id }),
      );
    expect((await save(bob, 1, 'Bob edit')).status).toBe(200);
    const stale = await save(alice, 1, 'Alice stale edit');
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { code: 'conflict', details: { version: 2 } } });

    const missingVersion = await documentRoute.PATCH(
      request(`/api/documents/${document.id}`, {
        method: 'PATCH',
        json: { content: paragraphDoc('x') },
        cookie: alice,
      }),
      params({ id: document.id }),
    );
    expect(missingVersion.status).toBe(422);

    const bobDelete = await documentRoute.DELETE(
      request(`/api/documents/${document.id}`, { method: 'DELETE', cookie: bob }),
      params({ id: document.id }),
    );
    expect(bobDelete.status).toBe(403);
  });

  it('imports a file into a new document and rejects unsupported types', async () => {
    const form = new FormData();
    form.append('file', new File(['# Imported\n\nHello **world**'], 'hello.md', { type: 'text/markdown' }));
    const response = await importRoute.POST(
      request('/api/import', { method: 'POST', body: form, cookie: alice }),
      undefined,
    );
    expect(response.status).toBe(201);

    const list = await documentsRoute.GET(request('/api/documents?filter=owned', { cookie: alice }), undefined);
    const { documents } = (await list.json()) as { documents: { title: string; owner: { id: string } }[] };
    expect(documents.find((doc) => doc.title === 'Imported')?.owner.id).toBe(ALICE);

    const bad = new FormData();
    bad.append('file', new File(['%PDF-1.7'], 'scan.pdf', { type: 'application/pdf' }));
    const rejected = await importRoute.POST(
      request('/api/import', { method: 'POST', body: bad, cookie: alice }),
      undefined,
    );
    expect(rejected.status).toBe(415);
  });
});
