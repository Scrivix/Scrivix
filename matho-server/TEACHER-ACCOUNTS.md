# Invite-only teacher accounts — prepared, not activated

This change replaces private editing links with Google sign-in and explicitly linked Apple sign-in. Existing libraries and live games remain on the current service until provider registration and activation are complete.

## Provider registration

### Google

Create a Google Auth Platform OAuth client of type **Web application** in a project owned by the site owner.

- App name: MATHO
- Audience: External (the owner uses a personal Gmail account)
- Authorized JavaScript origin: https://scrivix.us
- Scopes: basic OpenID identity, email, and profile only; no Gmail, Drive, or Classroom access
- This implementation uses the Google Identity Services JavaScript credential callback, so it does not require a client secret or a backend OAuth redirect URL.
- While testing, add the owner and any invited test teachers to the Google project's test-user list as required by its audience settings.
- Supply the public web client ID as the Worker setting MATHO_GOOGLE_CLIENT_ID.

References: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid and https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

### Apple

The owner confirmed an Apple Developer Program membership. Configure a Services ID associated with an existing primary App ID enabled for Sign in with Apple.

- Domain: scrivix.us
- Return URL: https://scrivix.us/matho/signin/
- Supply the Services ID as MATHO_APPLE_CLIENT_ID.
- The JavaScript popup returns an identity token. The service validates its signature, issuer, audience, age, expiry, and browser-bound nonce. It does not request Apple API access or exchange authorization codes for refresh tokens.
- First sign in using the owner's Google account. Use **Link Apple sign-in** from that authenticated account. Apple relay email addresses never automatically merge accounts.

Reference: https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web

## Owner configuration

Set MATHO_OWNER_EMAIL in the existing Cloudflare Worker settings to the home Google email chosen by the user in this conversation. Keep the actual address out of this public repository. The first verified Google identity with that exact address becomes the single owner. After that, the provider subject is the identity; another subject cannot take ownership by presenting the same email.

Install the owner email through Cloudflare’s protected settings or another approved configuration path. It is intentionally absent from this public repository.

## Activation order

1. Register and obtain the public Google client ID and Apple Services ID. Do not ask the user for passwords or private keys.
2. Apply the additive migration 0003_teacher_accounts.sql to the existing D1 database; do not reapply the initial schema or change relay/library tables.
3. Deploy the Worker and frontend together, initially without provider settings if needed. Without MATHO_GOOGLE_CLIENT_ID and a valid MATHO_OWNER_EMAIL, accounts are inactive and existing private libraries continue to function.
4. Configure the exact Google client ID and owner email, then verify a real Google sign-in as the owner. Provider settings enable invitation-only library and hosting access, so coordinate the switch with the owner.
5. In the same browser that holds the original library, open the library while signed in as owner. The client proves the old key to the server. Migration moves sets into the owner's account library, preserves set IDs and all saved versions, and rotates the old key. It is transactional and safe to retry.
6. Verify a second device sees the same sets and an unrelated account cannot read or modify them. Test nonce/CSRF rejection and logout with the actual provider.
7. Configure Apple, link it while signed in as Google owner, and verify it opens the same account. Do not turn a same-email match into account linking.
8. Verify a student joins without a teacher account, a signed-in teacher can host, and the existing private iPad remote still pairs.

## Controls included

- Server-side signed ID-token verification via jose with fixed Google/Apple JWKS URLs, RS256 only, expected audience/issuer, required expiry/issued-at/nonce, and maximum token age.
- Browser-bound one-use ten-minute challenges, strict request origins, CSRF tokens for authenticated mutations, and Secure HttpOnly SameSite=Lax host-only session cookies.
- Session IDs stored hashed in D1; fourteen-day expiry; sign-out ends that device's session.
- Owner-only invitation and access management, up to five invited teachers by default. Libraries are isolated by account, including from other teachers who know their IDs.
- New hosting requires an approved account. Atomic limits: two active primary games per teacher, ten globally, and fifty room reservations per teacher per UTC day. Remote pairing has a separate limit and requires an owned primary game. These are application usage controls, not a guarantee of a maximum Cloudflare bill.
- Revoking a teacher invalidates their sessions and ends their active rooms. It preserves their question sets.
- Authenticated migration retires private editing keys. Shared public site links do not grant editing access.
- Student joins, public metadata without answers, and existing classroom broadcasts retain their existing behavior.
- MathJax's ui/safe filter blocks user-authored equation links, custom IDs, and classes on caller/student/remote pages.

## Verification

Use Node 24 and install this service's dependencies. Run from repository root:

    node matho-server/tests/accounts.mjs
    node matho-server/tests/teacher-library.mjs
    node matho-server/tests/teacher-library-client.cjs
    node matho-server/tests/simple-library.cjs
    node matho-server/tests/relay.mjs
    node matho-server/tests/teacher-library-game.cjs scientific-notation

The account test uses locally generated RSA-signed tokens and exercises actual token verification, SQL transactions, owner bootstrap, invitations, cross-library denial, link retirement, Apple linking, CSRF, nonce replay and browser binding, quotas, revocation, logout, and expiry. Real Google/Apple login and browser-device behavior remain unverified until their public client identifiers are supplied.
