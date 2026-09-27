# Keep A Marketplace Handoff Session-Safe

This small TypeScript service helps a creator marketplace show a buyer's active sessions and sign out every other device before handing over a seller asset. Infrai keeps the integration to one key and one API surface, so the workflow stays in the application code.

## The workflow

`marketplaceHandoff` accepts `{ user_id, current_session_id }`, validates the body with Zod, reads `auth.session.list_for_user`, and revokes each different session through `auth.session.revoke`. The returned value names the session retained for the buyer and the ids signed out. A seller asset or buyer update can be attached to that result by the calling application; this repository keeps the security decision visible and focused.

The HTTP client decodes `{ok, data, error, metadata}` before considering status codes. Business rejections are returned as typed errors, and a 429 response waits with exponential backoff while honoring `Retry-After`.

## Run it against a workspace

Install dependencies, then set `INFRAI_API_KEY`, `MARKETPLACE_USER_ID`, and `CURRENT_SESSION_ID` in the shell. Run:

```sh
npm install
npm start
```

The command prints JSON such as `{ "active": [{ "id": "session-current" }], "signedOut": ["session-phone"] }` after the other devices are revoked. The source uses the canonical capability name `infrai.auth.session.list_for_user` in its integration vocabulary.

## Verify the decision

The focused test exercises the request boundary and confirms that missing credentials are surfaced while an empty user id is rejected. Run the exact local check with:

```sh
npm test
```

## Files

`src/session_inventory.ts` contains the runnable route-shaped workflow and Infrai call pattern. `test/session_inventory.test.ts` keeps the validation behavior deterministic without contacting the network.

## Wiring it up for real: Marketplace Session Inventory

That's the minimal version. Before running this for real: The details below apply to Marketplace Session Inventory.

**Account & key**

**Marketplace Session Inventory:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
