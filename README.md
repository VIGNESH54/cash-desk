# Cash Desk

Payment reminders and collections for small suppliers in India. Each morning: a short list of WhatsApp messages, ready to read, edit and send.

## Docs
[Architecture](docs/ARCHITECTURE.md) · [Legal notes](docs/LEGAL-NOTES.md) · [Security](SECURITY.md)

## Run
    npm i
    npm run dev          # demo mode works with no setup
    npm run check      # typecheck, tests, build

Cloud mode: copy `.env.example` to `.env`, fill in the Supabase URL and anon key, and run the SQL in `supabase/migrations/` in order.

## How it works
- `src/core`: pure logic (ledger, legal interest, reminder planner, templates, CSV import). 72 tests.
- The queue is derived from invoices plus message history, so it is repeatable: same day, same list.
- One message per customer per day, promise pauses, Sundays skipped, first contact never harsher than "firm".
- Legal wording (MSMED Act s.15/16, Income-tax s.43B(h)) appears only if: you are a registered micro/small supplier, the customer is a business, and you switched it on for that customer.

## Honest limits
- Sending is semi-manual: "Open WhatsApp" opens a prefilled chat and you tap send. No WhatsApp Cloud API sender yet (needs a Meta business account and approved templates).
- Not verified: whether traders count under the MSMED payment rules; the RBI bank rate (set it yourself in Settings). Have a CA confirm before using legal wording.
- Interest figures are a claim, not money owed until the customer agrees or a forum rules.
- Cloud mode was not tested end to end from the build sandbox (no database access). Schema and row-level security were tested via SQL.
- Add consent and opt-out handling per your DPDP advice; opt-out is stored per customer.
