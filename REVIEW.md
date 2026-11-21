# Scoped project review — 21 November 2026

Reviewed the current GitHub source, browser-origin policy, signed sessions, database TLS, and both web builds. The original local project and its untracked delivery artifacts were preserved. This is a scoped engineering review, not a clinical validation, penetration test, or production certification.

## Changes

- Production browser requests no longer implicitly trust every localhost/private-network origin. Explicit configured web/admin/native origins remain supported; development retains private-network convenience. Rejected origins receive HTTP 403 before reaching routes.
- Signed-session verification uses constant-time HMAC comparison and rejects malformed signatures. Production cookies always use `Secure`.
- Remote PostgreSQL connections verify server certificates. Localhost detection uses the parsed hostname; text elsewhere in a connection URL cannot disable TLS. URL TLS options cannot override the explicit policy. `PGSSL_CA` supports provider-specific trust roots.
- Environment examples use explicit placeholders, document administrator credentials, trusted origins, and certificate setup.
- Added regression tests and GitHub Actions to check security helpers and both web builds.

## Verification

- Security regression tests: 8 passed, including bundled provider-CA coverage.
- Backend `server.js` syntax check: passed.
- Customer frontend production build: passed after installing root dependencies as documented (Capacitor is a root dependency).
- Admin frontend production build: passed.
- Prior Android testing: the project owner confirms that the Android app was tested and notifications worked successfully. This is an owner-reported result from earlier testing, not a fresh Android run during this source review.

The automated regression tests do not connect to a database, send notifications, call an AI provider, or process real patient data. A separate read-only `SELECT 1` check against the existing configured database passed with `encrypted=true` and `certificateVerified=true` after adding the public Supabase CA. No records or schemas were changed. This confirms connectivity and certificate trust, not complete API persistence or isolated staging acceptance. Android packaging was not rerun; AI and notification provider credentials were not checked.

## Portfolio presentation

The English README now includes a screenshot cover, synthetic demo gallery, architecture, setup, and recorded evidence. [The case study](https://today-care-case-study.vercel.app) follows the Pawfect presentation structure and includes keyboard-operable screenshot selection and enlargement. The two new case-study sites passed 22 combined responsive/interaction checks, including 320, 390, 768, and 1440px layouts. Screens are captured from actual built UI with synthetic intercepted responses; their totals are not business or patient outcomes.

## Deployment requirements

Set exact production `ALLOWED_ORIGINS` for the customer app, admin app, and any native client. Use HTTPS for production cookie sessions. The verified public Supabase CA is bundled in `backend/certs` and selected for Supabase hosts. `PGSSL_CA` takes priority for other providers or CA rotation. `npm --prefix backend run db:check` repeats the read-only check with your own local configuration. Run full application acceptance in an isolated staging environment before a broader release.

## Next priorities

- Add isolated API/database tests for registration, session expiry, per-user medical records, and admin authorization.
- Add distributed authentication/request throttling and review retention/access controls for health data.
- Keep medical-support scope and limitations visible; use synthetic data in portfolio demonstrations.
- Rerun Android notification checks when changes affect the Android app or notification flow. Review mobile accessibility, provider failure states, and dependency advisories separately.
