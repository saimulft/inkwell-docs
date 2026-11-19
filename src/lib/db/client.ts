import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { seedDemoData } from './seed';

/**
 * Both drivers expose the same Drizzle query API, so the app is typed against the node-postgres flavour.
 * Production (Vercel) uses Postgres via DATABASE_URL; local dev and tests use PGlite, an embedded Postgres,
 * so the project runs with zero setup and the same SQL dialect everywhere.
 */
export type Db = NodePgDatabase<typeof schema>;

declare global {
  var __inkwellDb: Promise<Db> | undefined;
}

export const migrationsFolder = () => path.join(process.cwd(), 'drizzle');

export function getDb(): Promise<Db> {
  globalThis.__inkwellDb ??= createDb().catch((error: unknown) => {
    globalThis.__inkwellDb = undefined;
    throw error;
  });
  return globalThis.__inkwellDb;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const [{ Pool }, { drizzle }] = await Promise.all([import('pg'), import('drizzle-orm/node-postgres')]);
    const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
    return drizzle(pool, { schema });
  }
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), '.data', 'pglite');
  return createPgliteDb({ dataDir, seed: true });
}

/** Embedded Postgres: on disk for local dev, in memory for tests. Migrates (and optionally seeds) on open. */
export async function createPgliteDb({ dataDir, seed }: { dataDir?: string; seed: boolean }): Promise<Db> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ]);
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  if (seed) await seedDemoData(db as unknown as Db);
  return db as unknown as Db;
}
