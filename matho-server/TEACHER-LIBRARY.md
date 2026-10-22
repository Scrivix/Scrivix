# Private MATHO teacher library

Prepared on October 22, 2026. Activate the backend before publishing this feature to main.

## Teacher workflow

- Open /matho/library/ and create a library, or connect an existing private library link.
- Save that private connection link in a safe place. It grants full editing access. The page generates its QR code locally.
- Open the link on an iPad, home computer, or school computer to connect that browser.
- Bring existing browser question banks into the library as separate sets, including custom questions.
- Use Edit questions on the saved library copy; edits save automatically after a short pause.
- New sets can be saved as unfinished drafts. Student boards require five distinct enabled answers per column, except T requires four.
- Concurrent changes never silently overwrite newer saves. On a conflict, keep the local draft and save it as a separate copy.
- Saved versions can be recovered into a separate set without replacing the current set.
- Give students the normal /matho/join/ link and room code, never the private library link.
- Existing game rooms keep their original question bank throughout their rounds.
- Built-in sets and browser banks remain separate; there is no replacement-defaults button.

## Storage and access

New D1 tables use the teacher_ prefix and are separate from relay rooms. Libraries do not expire with a classroom game.
Library access uses a random 256-bit private key; only its SHA-256 hash is stored in D1. Browser credentials stay in localStorage.
Private links use fragments, are removed from the library page address bar before network work, and the library page sets no-referrer.
Public custom-set metadata contains directions and display settings, never questions, answers, library credentials, or student boards.
All edits require the private library key. Revisions use compare-and-swap and immutable snapshots in a transactional batch.
The client preserves offline drafts and keeps local bank backups before imports or loading a newer saved version.
Only one new row per saved version plus the current-set row is written; there is no library background polling.

## Activation

Use Cloudflare Wrangler authenticated to account c8aa075b5487429945a235121d6f613f.
The retained wrangler.jsonc already identifies the existing matho-rooms Worker, matho-live.scrivix.us, and matho-rooms D1 database.

1. Execute only migrations/0002_teacher_library.sql against the remote matho-rooms D1 database. All statements are additive CREATE IF NOT EXISTS.
2. Deploy server/worker.mjs with its existing relay.mjs and new library.mjs imports. Preserve current bindings, origins, and custom domain.
3. Verify /health remains healthy, /v1/library-health responds, and an authenticated create/save/read cycle works across two clients. Confirm public metadata omits answers and a stale write returns 409.
4. Publish the frontend branch after successful backend verification.
5. Verify GitHub Pages deployment.

Do not apply the old initial schema again, delete relay tables, change billing plans, or publish credentials.
Local implementation and Wrangler installation are in the task workspace's matho-library-work directory. Its .config and logs are private and excluded from GitHub entries.

## Verification

From repository root, Node 24 (node:sqlite) runs:
- node matho-server/tests/teacher-library.mjs
- node matho-server/tests/teacher-library-client.cjs
- node matho-server/tests/teacher-library-game.cjs scientific-notation
- node matho-server/tests/relay.mjs
- node matho-server/tests/add-question.cjs scientific-notation
- node matho-server/tests/simultaneous-winners.cjs scientific-notation

The Worker also passes Wrangler deploy --dry-run. Browser/device visual checks were not available in this session.
