# Scoped project review — 21 November 2026

Reviewed the current GitHub source, browser-origin policy, signed sessions, database TLS, and both web builds. The original local project and its untracked delivery artifacts were preserved. This is a scoped engineering review, not a clinical validation, penetration test, or production certification.

## Changes

- Production browser requests no longer implicitly trust every localhost/private-network origin. Explicit configured web/admin/native origins remain supported; development retains private-network convenience. Rejected origins receive HTTP 403 before reaching routes.
- Signed-session verification uses constant-time HMAC comparison and rejects malformed signatures. Production cookies always use `Secure`.
- Remote PostgreSQL connections verify server certificates. Localhost detection uses the parsed hostname; text elsewhere in a connection URL cannot disable TLS. URL TLS options cannot override the explicit policy. `PGSSL_CA` supports provider-specific trust roots.
- Environment examples use explicit placeholders, document administrator credentials, trusted origins, and certificate setup.
- Added regression tests and GitHub Actions to check security helpers and both web builds.

## Verification

- Security regression tests: 7 passed.
- Backend `server.js` syntax check: passed.
- Customer frontend production build: passed after installing root dependencies as documented (Capacitor is a root dependency).
- Admin frontend production build: passed.
- Prior Android testing: the project owner confirms that the Android app was tested and notifications worked successfully. This is an owner-reported result from earlier testing, not a fresh Android run during this source review.

The automated tests in this review do not connect to a database, send notifications, call an AI provider, or process real patient data. Android packaging was not rerun during this review. Live database connectivity after the TLS changes, API persistence, and provider credentials remain unverified in this review.

## Deployment requirements

Set exact production `ALLOWED_ORIGINS` for the customer app, admin app, and any native client. Use HTTPS for production cookie sessions. Provide the database provider's trusted CA through `PGSSL_CA` when the default trust store does not recognize its certificate, then validate the connection in staging before deploying. Missing trust configuration should be corrected rather than disabling verification.

## Next priorities

- Add isolated API/database tests for registration, session expiry, per-user medical records, and admin authorization.
- Add distributed authentication/request throttling and review retention/access controls for health data.
- Keep medical-support scope and limitations visible; use synthetic data in portfolio demonstrations.
- Rerun Android notification checks when changes affect the Android app or notification flow. Review mobile accessibility, provider failure states, and dependency advisories separately.
