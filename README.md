# Orca Edge Tool 2: Document Generation & Review Automation

Internal, staff facing document engine. Sold and delivered as a standalone
product. Law firm beachhead. Requires no other Orca Edge tool.

## The two rules this codebase does not bend

1. **The AI never fills a gap.** A field that was not stated stays empty, and an
   empty required field blocks generation. Numbers always require explicit
   confirmation, because dictation mishears figures.
2. **The AI never touches fixed clauses.** Standard terms and regulatory wording
   are merged by code in `lib/engine.js`. The model only drafts sections the
   template declares as `bespoke`, and only criticises the assembled result.

A qualified person signs off on every document. There is no auto-approve path
in this codebase, by design.

## Layout

| Path | What it holds |
| --- | --- |
| `db/schema.sql` | Full schema. Safe to re-run |
| `db/seed.sql` | Illustrative demo law firm and one engagement letter template. Safe to re-run |
| `lib/db.js` | Neon connection, with the env var fallback chain |
| `lib/store.js` | The data layer seam. Nothing above this file touches Postgres |
| `lib/engine.js` | Assembly, bespoke drafting, deterministic rules, AI review pass |
| `api/` | Serverless functions |
| `src/` | React front end |

## Setup

1. Vercel: import this repo into the Orca Edge team, framework preset Vite.
2. Neon: create a project, copy the pooled connection string.
3. Vercel environment variables: see `.env.example` for the names.
4. Neon SQL editor: run `db/schema.sql`, then `db/seed.sql`.

Then open the deployment. The front page reports which of those steps is done
and which is not.

## Note on templates

A template is configuration the engine reads, never code. Digitising a document
means writing a `definition` JSON object, not adding a file. That distinction is
what makes this a product rather than a consultancy engagement, and it cannot be
retrofitted later without pain.

## Function budget

Vercel Hobby caps at 12 serverless functions. Planned: auth, matters, capture,
templates, generate, review, documents, output, send. Nine, with headroom.
