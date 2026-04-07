# External credentials via JellyByte-Server

The web app no longer writes external-site credentials directly to `public.users.credentials`.

## Current flow

- Supabase Auth remains the identity layer for JellyByte accounts
- `JellyByte-Web` sends the signed-in user's Bearer token to `JellyByte-Server`
- `JellyByte-Server` owns `GET /api/credentials`, `POST /api/credentials/:site`, and `DELETE /api/credentials/:site`
- plaintext passwords are only sent from the browser during save/replace
- saved plaintext passwords are never fetched back into the UI afterward

## Public API shape

`GET /api/credentials` returns safe metadata only:

```json
[
  {
    "site": "trip.com",
    "username": "user@example.com",
    "updatedAt": "2026-04-02T12:00:00.000Z"
  }
]
```

`POST /api/credentials/:site` is an upsert and also returns metadata only.

## Deprecated direct-Supabase path

Older notes in this repo referenced `public.users.credentials`, `sync_vault_credentials`, and `get_decrypted_password`.
That path is deprecated for agent-driven external-site credentials and should not be used for new frontend work.
