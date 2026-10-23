# Shared question banks

Production shared banks live only in the Cloudflare D1 table builtin_question_sets. They are not shipped as static answer files or embedded in client scripts.

GET /v1/teacher-sets/:slug requires an active approved owner/teacher session and returns private, no-store responses. There is no shared-set mutation API. Teachers copy into their own separately authorized libraries to edit.

The public catalogue and per-set direction/config files contain metadata only; student entry remains account-free. Student game-state messages include called expressions and their own board, not the complete question/answer bank.

To update shared originals, use an owner-authorized deployment operation against private D1 data; never commit a production answer bank or seed file to the public source repository. Existing rooms keep their snapshots.

Previously published banks may remain in browser/CDN caches and historical public Git commits. Removing current static files does not erase historical or downloaded copies. Restricting repository history or retiring that public source requires a separate hosting/repository decision.

Local regression tests that read historical bank fixtures require private local fixtures; do not restore production banks to the public tree merely to run those tests. Access-control tests use a synthetic fixture.
