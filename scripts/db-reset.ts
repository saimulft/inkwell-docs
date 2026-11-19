/**
 * Wipes all documents, comments, versions and sessions, then re-seeds the demo data.
 * For the hosted demo database only (DATABASE_URL); locally, delete the .data folder instead.
 * Usage: npm run db:reset -- --yes
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../src/lib/db/schema';
import { seedDemoData } from '../src/lib/db/seed';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.log('DATABASE_URL is not set. To reset the local database, delete the .data folder.');
    return;
  }
  if (!process.argv.includes('--yes')) {
    console.log('This deletes every document in the database. Re-run with --yes to confirm.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: 'drizzle' });
    await db.execute(sql`truncate table documents, sessions, document_presence restart identity cascade`);
    await seedDemoData(db);
    console.log('Demo data reset.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
