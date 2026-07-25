// Neon Postgres connection.
// Env var fallback chain matches the rest of the Orca Edge stack, so any of
// Neon's or Vercel's default variable names will work without reconfiguration.

import { neon } from '@neondatabase/serverless';

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED;

let _sql = null;

export function sql(...args) {
  if (!CONNECTION_STRING) {
    throw new Error(
      'No database connection string. Set DATABASE_URL in the Vercel project environment variables.'
    );
  }
  if (!_sql) _sql = neon(CONNECTION_STRING);
  return _sql(...args);
}

export function dbConfigured() {
  return Boolean(CONNECTION_STRING);
}
