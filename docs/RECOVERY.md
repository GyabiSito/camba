# Rehearse backup and recovery

Do not test a restore against the existing store, its database, or its media. Use a separate Compose project, new volumes, synthetic secrets, and a disposable destination. For a real cutover obtain an approved data export and backup window; do not replay old data over orders accepted by the new store.

## Minimum backup set

- **MySQL:** a consistent logical dump (single transaction for InnoDB, no table locks) of the v2 schema. Use the dedicated backup account/configuration; never pass real credentials to logs or shell history.
- **Media and private state:** the public-media volume (original derivatives and thumbnails) and the private-files volume, using a non-production snapshot or a consistent maintenance window. Inventory referenced paths and compare file hashes.
- **Queues and sessions:** the Redis volume/AOF if required for the restore point. Durable payment and notification inboxes are in MySQL; recheck their cursors and their pending/uncertain states before resuming the worker or scheduler. Never replay a real payout, webhook, or ambiguous mail to test recovery.
- **Configuration:** current and previous digest manifests, site settings, the protected runtime configuration and stable `APP_KEY` (including any previous encryption keys) in the operator's secret store. A database dump alone cannot recover encrypted order snapshots.

## Isolated rehearsal checklist

1. Record source image versions and orderly stop writes from the scratch application. Keep other projects untouched. Make the logical dump with `mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF` for the synthetic source schema.
2. Restore into a newly created, differently named scratch schema using `mysql` with explicit destination. Compare table counts, a synthetic order/stock marker, media hashes, and migration list. Start the same app image on the restored project; check `/up`, `/ready`, persisted records, and lack of an automatic seed.
3. Keep the restore and previous release references until the operator verifies them. For a failed image-only rollout, restore the images without touching the database or media. For a data incident, stop writes, preserve evidence, and recover into separate infrastructure before choosing a cutover. An image rollback does not reverse migrations or remove new orders.

The current rehearsal compared a MySQL dump and restore with a synthetic marker. Full media/Redis recovery, real account history, and a production outage have not been rehearsed.
