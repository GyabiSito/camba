# Rehearse backup and recovery

Do not test a restore against the existing store, its database, or its media. Use a separate Compose project, new volumes, synthetic secrets, and a disposable destination. For a real cutover obtain an approved data export and backup window; do not replay old data over orders accepted by the new store.

## Minimum backup set

- **PostgreSQL:** a consistent custom-format `pg_dump` of the v2 database, captured from the PostgreSQL service with the dedicated backup account. Keep the dump and password out of logs and shell history.
- **Media and private state:** the public-media volume (original derivatives and thumbnails) and the private-files volume, using a non-production snapshot or a consistent maintenance window. Inventory referenced paths and compare file hashes.
- **Queues and sessions:** the Redis volume/AOF if required for the restore point. Durable payment and notification inboxes are in PostgreSQL; recheck their cursors and their pending/uncertain states before resuming the worker or scheduler. Never replay a real payout, webhook, or ambiguous mail to test recovery.
- **Configuration:** current and previous digest manifests, site settings, the protected runtime configuration and stable `APP_KEY` (including any previous encryption keys) in the operator's secret store. A database dump alone cannot recover encrypted order snapshots.

## Isolated rehearsal checklist

1. Record source image versions and orderly stop writes from the scratch application. Keep other projects untouched. Make a custom-format dump with `pg_dump --format=custom --no-owner --no-privileges` for the synthetic source database.
2. Restore into a newly created, differently named scratch database using `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges` with an explicit destination. Compare table counts, a synthetic order/stock marker, media hashes, and migration list. Start the same app image on the restored project; check `/up`, `/ready`, persisted records, and lack of an automatic seed.
3. Keep the restore and previous release references until the operator verifies them. For a failed image-only rollout, restore the images without touching the database or media. For a data incident, stop writes, preserve evidence, and recover into separate infrastructure before choosing a cutover. An image rollback does not reverse migrations or remove new orders.

The recovery drill now uses isolated PostgreSQL databases and real custom-format dumps. Full media/Redis recovery, real account history, and a production outage remain distinct from this local rehearsal.
