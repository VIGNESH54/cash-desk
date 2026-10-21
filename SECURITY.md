# Security

- Report issues privately to the repository owner, not in public issues.
- Secrets: only the Supabase URL and the public anon key go in the browser build. Never commit `.env`.
- Data access is enforced in Postgres by row-level security, not in the UI.
- Phone numbers and payment history are personal data: keep exports private.
