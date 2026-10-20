# MATHO online room service — prepared, not deployed

This relay replaces browser-to-browser networking with ordinary HTTP requests.
Production must use HTTPS. The existing shared teacher/student game stays authoritative;
question sets, boards, timers, claim checking and private results use the same game engine.

**Status:** the Cloudflare Worker and database are deployed and passed live API tests. The website uses this service through the shared HTTPS transport. Public student access was approved on October 20, 2026.

Service: https://matho-live.scrivix.us
Worker: matho-rooms
Database: matho-rooms, bound as DB

## Files

- `server/relay.mjs`: fetch-style API, bearer credentials, private inboxes and deduplicated messages.
- `server/schema.sql`: schema to apply before serving requests, outside request handling.
- `server/node.mjs`: Node 24+ HTTP adapter and persistent SQLite store.
- `server/worker.mjs`: Worker/D1 entry point using the same API.
- `client/https-peer.js`: transport adapter for the existing teacher and student scripts.
- `prepare-preview.py`: generates a disposable copy of the canonical game for local tests.
  This generated copy is not a separately maintained game version.
- `tests/`: API and real-game integration tests.

The teacher host secret stays in the teacher tab's session storage. The server stores its hash.
Student relay credentials are independent of the student's saved game-board token. Tokens never
appear in join URLs. Only the teacher can deliver board state or results to a student. Students
can send to the host and read their own inbox. Message IDs suppress duplicate retries. Host
cursors and room generation IDs prevent replaying old claims after refresh or database reset.

Idle rooms expire after four hours without teacher polls. Messages are retained for 30 minutes,
with cleanup on subsequent traffic. Teacher recovery remains browser-session based. Room
creation is bounded per server instance; a room supports 60 active student transport sessions.
The production host should retain its platform request limits.

## Local verification

Run from the parent workspace:

    node math-bingo-live/tests/relay.mjs
    node math-bingo-live/tests/game-over-https.cjs addition
    node math-bingo-live/tests/game-over-https.cjs exponents

For a browser preview, generate it with `python3 math-bingo-live/prepare-preview.py`.
Start `node server/node.mjs` inside `math-bingo-live` with environment variables
`MATHO_DB=:memory:` and `MATHO_ORIGINS=http://localhost:8766`.
Serve the generated preview folder on port 8766 using a static HTTP server.
Open `http://localhost:8766/game/room.html?set=addition`.
The preview calls localhost port 8787 and does not use WebRTC, UDP or WebSockets.

## Publication handoff

1. Deploy the relay as a public HTTPS service. For Node, use one instance with a persistent
   SQLite file (`MATHO_DB`) and set `HOST=0.0.0.0`, `PORT`, and `MATHO_ORIGINS=https://scrivix.us`.
   The hosting platform must terminate TLS.
2. For Workers, bind `DB` to D1, apply the schema as a migration, and bundle `worker.mjs`
   with `relay.mjs`. Do not create tables from a request handler.
3. Verify `/health` and authenticated room/join/poll/send requests on the deployed endpoint.
4. Load `https-peer.js` instead of PeerJS for teacher and student pages. Set
   `MathoHttpsPeer.endpoint` and `globalThis.Peer=MathoHttpsPeer` before loading their game
   scripts. The preview builder demonstrates the shared bootstrap change.
5. Update networking help and cache versions. Deploy the website through the existing GitHub
   Pages workflow only after the relay is verified.
6. Refresh teacher/student pages, create a new room, and retest on the actual school networks.

The school must permit the relay's HTTPS destination. No firewall changes or bypasses are part
of this code. The live website is intentionally unchanged while deployment remains blocked.

## Cloudflare maintenance

The retained `wrangler.jsonc` identifies the existing Worker, custom domain and database. It contains no credentials. Authenticate with your own Cloudflare account before using Wrangler. The database schema was applied through the dashboard on October 20, 2026. Future schema changes should be new numbered migrations; do not replace existing tables.

The transport holds ordinary HTTPS requests open for up to 18 seconds and delivers changes as soon as the next indexed inbox read sees them. This reduces idle request counts. Repeated identical state and ping messages stay local; database heartbeat writes are throttled. Room and message expiry queries use indexes. Ended student connections stop polling.

On GitHub, this source is under `matho-server`. From the repository root, run `node matho-server/tests/game-over-https.cjs addition` (or `exponents`) for the retained full-game checks. API-only tests run with `node matho-server/tests/relay.mjs`.
