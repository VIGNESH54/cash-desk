# Cash Desk

Payment reminders and collections for small suppliers in India. Each morning: a short list of WhatsApp messages, ready to read, edit and send.

## Docs
[Architecture](docs/ARCHITECTURE.md) · [Legal notes](docs/LEGAL-NOTES.md) · [Security](SECURITY.md)

## Run
    npm i
    npm run dev          # demo mode works with no setup
    npm run check      # typecheck, tests, build
npm run e2e        # 36 browser tests, phone and desktop (set CHROMIUM_PATH if Chromium is preinstalled)

Cloud mode: copy `.env.example` to `.env`, fill in the Supabase URL and anon key, and run the SQL in `supabase/migrations/` in order.

## How it works
- `src/core`: pure logic (ledger, legal interest, reminder planner, templates, CSV import). 116 unit and simulation tests.
- The queue is derived from invoices plus message history, so it is repeatable: same day, same list.
- One message per customer per day, promise pauses, Sundays skipped, first contact never harsher than "firm".
- Legal wording (MSMED Act s.15/16, Income-tax s.43B(h)) appears only if: you are a registered micro/small supplier, the customer is a business, and you switched it on for that customer.

## Honest limits
- Sending is semi-manual: "Open WhatsApp" opens a prefilled chat and you tap send. No WhatsApp Cloud API sender yet (needs a Meta business account and approved templates).
- Not verified: whether traders count under the MSMED payment rules; the RBI bank rate (set it yourself in Settings). Have a CA confirm before using legal wording.
- Interest figures are a claim, not money owed until the customer agrees or a forum rules.
- Cloud mode was not tested end to end from the build sandbox (no database access). Schema and row-level security were tested via SQL.
- Add consent and opt-out handling per your DPDP advice; opt-out is stored per customer.

## Quality gates
- 150-day simulation over 40 random businesses: one message per customer per day, nothing on Sundays, never to opted-out customers, legal wording only when allowed, repeatable queue. It found and fixed a real bug (skipping a message surfaced the next one at once).
- Browser tests cover send, skip, payments, promises, import, settings, opt-out, statement, demo time travel, script injection, overflow and accessibility (axe, WCAG A/AA) on phone and desktop.
- Errors: error boundary, global handlers, `client_errors` table (insert-only for signed-in users, read in the Supabase dashboard).
- Database: `supabase/tests/rls_attack.sql` tries cross-tenant reads, writes and role abuse. Migration 4 (owner-only settings and deletes, FK indexes) must be applied before running it.
