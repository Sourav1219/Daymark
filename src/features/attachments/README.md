# Attachments

Owns signed upload policy, attachment metadata, storage-object lifecycle, authorization, and safe deletion.

Phase 10 is optional and enabled only when all four `R2_*` server variables are
configured. The browser sends file bytes directly to a five-minute presigned
PUT and never receives R2 credentials. The application does not submit or store
the browser filename.

Security flow:

1. An authenticated Server Action validates the Quest, declared allowlisted
   type, and claimed size before creating workspace-scoped pending metadata and
   a random staging key.
2. After PUT, the server reads R2's actual length and first bytes. It accepts
   only PDF, JPEG, PNG, or WebP signatures up to 10 MiB and requires the stored
   length to match the requested receipt.
3. The verified staging object is copied with a source ETag condition to a new
   random permanent key, inspected again, and the staging object is deleted.
   Reusing the upload URL can therefore never overwrite a ready attachment.
4. Downloads require current membership and ready workspace metadata before a
   60-second GET URL is signed. Deletes use a retry-safe deleting state.
5. `/api/cron/attachments` removes expired pending uploads and stalled deletes
   in bounded batches using `CRON_SECRET`.

The R2 bucket remains private. Browser PUTs require a bucket CORS policy based
on [`docs/r2-cors.example.json`](../../../docs/r2-cors.example.json); replace
the example origin with the exact application origin. A bucket-scoped Read &
Write API token is sufficient. A one-day lifecycle rule on the `staging/`
prefix is recommended as defense-in-depth for objects that outlive a rare
database/storage coordination failure.
