# Purchase and payment logs

Laravel's `pagos` channel writes JSON Lines to `storage/logs/pagos/DDMMAAAA.log`. For example, November 25, 2026 in `America/Montevideo` goes to `25112026.log`. The logger chooses the path per record, including in an already running worker. The default log channel, stack, and level are unchanged.

In the Docker demo the files are inside the existing named `api-storage` volume. The production backend roles share their own `payment-logs` volume mounted at `storage/logs/pagos`; public frontend and proxy containers do not mount it. The normal volume lifecycle preserves logs across container recreation. Apply your retention policy to this volume separately from database backups.
