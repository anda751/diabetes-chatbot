# Supabase public CA

`supabase-ca.crt` is the public Supabase Root 2021 CA, not a client credential or private key. It was reused from the existing Pawfect project trust bundle and successfully verified the configured database connection during a read-only check on 21 November 2026. Its current certificate expires on 26 April 2031.

Monitor provider CA rotation. Use the documented CA environment override for a replacement trust bundle. Never publish a client private key here.
