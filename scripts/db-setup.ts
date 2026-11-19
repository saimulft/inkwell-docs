/**
 * Applies migrations and seeds the demo accounts and sample documents (idempotent).
 * Runs in the Vercel build (`vercel-build`) against the Neon database. Locally, PGlite does this on first request.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../src/lib/db/schema';
import { seedDemoData } from '../src/lib/db/seed';

async function main() {
  // Prefer the direct (unpooled) connection for migrations; the app itself uses the pooled DATABASE_URL.
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.log('DATABASE_URL is not set: the local PGlite database migrates and seeds itself. Nothing to do.');
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: 'drizzle' });
    await seedDemoData(db);
    console.log('Database migrated and demo data seeded.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
