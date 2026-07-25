// Setup check. Tells you exactly which of the four steps is not finished yet.
import { dbConfigured, sql } from '../lib/db.js';

export default async function handler(req, res) {
  const checks = {
    deployed: true,
    databaseUrlSet: dbConfigured(),
    anthropicKeySet: Boolean(process.env.ANTHROPIC_API_KEY),
    sessionSecretSet: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16),
    resendKeySet: Boolean(process.env.RESEND_API_KEY),
    schemaApplied: false,
    seedApplied: false,
    firm: null
  };

  if (checks.databaseUrlSet) {
    try {
      const t = await sql`
        SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN
          ('firms','users','clients','matters','matter_fields','templates','documents','document_versions','flags','approvals')`;
      checks.schemaApplied = (t[0]?.n || 0) >= 10;

      if (checks.schemaApplied) {
        const f = await sql`SELECT name, slug, vertical, branding FROM firms ORDER BY id LIMIT 1`;
        if (f[0]) {
          checks.seedApplied = true;
          checks.firm = f[0];
        }
      }
    } catch (err) {
      checks.databaseError = err.message;
    }
  }

  const ready = checks.databaseUrlSet && checks.anthropicKeySet &&
                checks.sessionSecretSet && checks.schemaApplied && checks.seedApplied;

  res.status(200).json({ ready, checks });
}
