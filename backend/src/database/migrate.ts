import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPool } from './create-pool.js';

/**
 * Applies the SQL migrations in ./drizzle. Runs as the pre-deploy job in production, where
 * drizzle-kit (a dev dependency) isn't installed. Locally, `pnpm db:migrate` does the same.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file, use the environment as-is.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const pool = createPool(databaseUrl, process.env.DATABASE_CA_CERT);

try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: 'drizzle' });
  console.log('Migrations applied');
} finally {
  await pool.end();
}
