# Rehearse recovery without touching the store

Run one local drill to restore Camba's PostgreSQL database and public/private media, restart a payment inbox after a process exit, and safely rebuild jobs on a fresh Redis instance. The drill makes its own synthetic data. **Do not give it a real database, export, credential, or media archive.** For incident planning, see [Recovery](RECOVERY.md).

## Run the drill

1. Use a local Docker engine with Compose and an installed Camba API **runtime** image. Build one from this checkout if needed: `docker build -t camba-recovery-api:local api`. The rehearsal itself does not pull images; it also requires the PostgreSQL, Redis and Mailpit images pinned in [`infra/recovery/compose.yml`](../infra/recovery/compose.yml).
2. From the repository root in PowerShell, run:

   ```powershell
   .\infra\recovery\rehearse.ps1 -ApiImage camba-recovery-api:local
   ```

3. Look for `OK: verify-jobs` and `OK: Mailpit captured one payment confirmation and no ambiguous replay`. The script prints the two generated Compose project names and an evidence directory under your system temp directory. A nonzero exit means a check failed. Both projects are stopped at exit; the generated volumes, database dump, media archive and pre-resume comparison JSON are retained for inspection.

The drill refuses remote Docker contexts and preexisting projects or schemas. Both networks are internal, with no published ports or host data mounts. Containers use only fixture credentials; there is no live Mercado Pago token. If Docker reports a custom subnet overlap, rerun to generate another private pair; do not remove someone else's network.

## What a pass proves

| Check | Expected observation |
| --- | --- |
| UC23: durable inbox after exit | The signed webhook returned 200; an independent CLI process exited immediately after committing the fake approval but before acknowledging the inbox. The process restarted before the lease expired without reading the provider. At expiry the restored target did one fake read and settled the inbox; repeat delivery did not add a payment, payment observation, or another stock deduction. |
| T06: database and media | The destination schema started empty, and only the source ran migrations. Source and target match for table counts, migration list, encrypted order (read through Laravel), stock, inbox/outbox/import markers and public/private file hashes. `/up` and `/ready` respond through Nginx; the public image is served byte-for-byte and the private file path returns 404. |
| T06: rebuild, don't blindly replay | The source had three queued jobs; the destination's Redis starts empty. Reconfirm the same durably recorded import and project due notices with `camba:notices`. The real Redis worker applies the single import row and delivers only one eligible payment confirmation to local Mailpit. The stale `sending` notice becomes `uncertain`; it never re-enters the queue. |

The interrupted payment uses Laravel's HTTP-client fake for one `GET /v1/payments/{id}` response; stray requests are rejected. This does not establish Mercado Pago webhook delivery, TLS, request retries or live-account behavior. The stale notice is seeded as a persisted `sending` state; this is not a claim that a real SMTP timeout was reproduced. Redis/AOF and cache/session restoration, authentication messages that have no commerce outbox, a real dataset and production recovery remain separate. Do not resend `uncertain` notices without checking whether the provider already accepted them.

## Recorded local run

On 2026-11-18, `.\infra\recovery\rehearse.ps1 -ApiImage camba-v2-local-api:ui` exited 0 on Docker Desktop Linux / Compose 2.34.0, using the installed image `sha256:6bdfd0afe1b72a35c03e6dcc1cb2306b779155c1edc9141b33a917268dd66d25`. The comparison covered 31 table counts and 15 migrations. The worker completed exactly two queued jobs and Mailpit received one message. The run retained its synthetic artifacts and pre-resume comparison in `$env:TEMP\camba-recovery-7482a987` on the machine that ran it.

The recorded run used the superseded MySQL recovery setup and is historical only, not evidence for PostgreSQL; record a new result after running the current isolated drill.
