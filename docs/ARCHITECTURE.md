# Architecture

```
src/core    pure logic, no I/O, no React. Everything the product decides lives here and is unit-tested.
src/data    Repo interface, DemoRepo (browser), CloudRepo (Supabase), row mappers.
src/app     React screens, a small hash router, one store.
supabase/   SQL migrations: schema, row-level security, helper functions.
```

## Decisions
- **The queue is derived, not stored.** `planDay(snapshot, today)` computes today's messages from invoices plus the history of sent/skipped reminders. Same inputs give the same list, so reloads, two devices and retries cannot double-send.
- **Dates are ISO strings (`YYYY-MM-DD`), arithmetic in UTC.** No timezone drift; "today" is computed in Asia/Kolkata.
- **Money is rounded to paise at each step** and shown in Indian grouping.
- **Every reminder is human-confirmed.** The app prepares a WhatsApp chat; the owner taps send. Nothing leaves without a person.
- **One message per customer per day**, promised dates pause reminders, Sundays skipped by default, first contact never harsher than "firm".
- **Legal wording is opt-in per customer** and only when the business is a registered micro/small supplier and the customer is a business.
- **Multi-tenant by row-level security.** Every table carries `business_id`; policies use `is_member(business_id)`; composite foreign keys stop a row pointing at another tenant's customer.

## Adding a rule
Change `src/core/planner.ts` or `legal.ts`, add a test in the matching `*.test.ts`, run `npm run check`.
