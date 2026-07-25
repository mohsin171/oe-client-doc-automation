# Orca Edge Tool 2: Document Generation & Review Automation

Internal, staff facing document engine. Sold and delivered as a standalone
product. Law firm beachhead. Requires no other Orca Edge tool.

## The two rules this codebase does not bend

1. **The AI never fills a gap.** A field that was not stated is never written to
   the database, so it stays missing, and a missing required field blocks
   generation. Figures always require explicit confirmation, whatever the source.
2. **The AI never touches fixed clauses.** Standard terms and regulatory wording
   are merged by code in `lib/engine.js`. The model drafts only blocks the
   template declares `bespoke`, and separately criticises the assembled result.

Sign-off is deliberate, role enforced on the server, and recorded with name,
version, timestamp and every dismissed flag with its reason. There is no
auto-approve path in this codebase, by design.

## What works today

- **Template ingestion.** Paste a document the firm has actually issued. The
  engine separates standard clauses from merged lines from sections drafted per
  matter, derives the required fields, and proposes review rules.
- **Matter opening.** Form capture with provenance on every field, and a
  completeness gate that shows plain arithmetic: captured against required.
- **Generation.** Deterministic assembly, precedent grounded bespoke drafting,
  firm review rules run before the model, then a separate AI critical pass.
- **Review and sign-off.** Draft beside flags, AI written sections visibly
  marked, inline editing, dismissal with a recorded reason, role enforced approval.
- **Output.** Branded Word document. Approved versions only.
- **Audit.** Full matter timeline and per document time logging for the value report.

## Not built yet

- **Login.** `lib/context.js` resolves every request to the firm owner. Replace
  `resolveContext()` before any real client data goes in. Needs `SESSION_SECRET`.
- **Dictation.** Needs a transcription provider. Anthropic does not process audio.
- **Sending.** Needs per firm domain verification. Download and compose works today.
- **Amendment awareness, storage integration, value report screen.**

## Layout

| Path | What it holds |
| --- | --- |
| `db/schema.sql` | Full schema. Safe to re-run |
| `db/seed.sql` | Illustrative demo law firm and one template. Safe to re-run |
| `lib/db.js` | Neon connection with the env var fallback chain |
| `lib/store.js` | The data layer seam. Nothing above it touches Postgres |
| `lib/engine.js` | Assembly, bespoke drafting, deterministic rules, AI review |
| `lib/ingest.js` | Turning a real document into a template definition |
| `lib/context.js` | Firm scoping and role checks. Placeholder auth lives here |
| `api/` | Five serverless functions |
| `src/` | React front end: queue, matter, review, templates |

## Setup

1. Vercel: import this repo, framework preset Vite.
2. Neon: create a project, copy the pooled connection string.
3. Vercel environment variables: see `.env.example`.
4. Neon SQL editor: run `db/schema.sql`, then `db/seed.sql`.

`/api/health` reports which of those steps is done.

## Note on templates

A template is configuration the engine reads, never code. Adding a document type
means saving a definition, not writing a file. That distinction is what makes
this a product rather than a consultancy engagement, and it cannot be retrofitted
later without pain.

## Function budget

Vercel Hobby caps at 12 serverless functions. Currently five: health, templates,
matters, documents, output. Headroom for capture, send, and auth.
