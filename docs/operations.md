# OpenChat operations runbook

## Health and failure handling

The authenticated **Settings → Operations** screen is the source of truth for durable work:

- **Failed events** are authenticated Telegram webhook payloads that were saved but could not finish persistence. Retry is idempotent and reuses the provider update ID.
- **Failed AI jobs** retain the latest conversation target and can be retried after correcting the provider or model configuration.
- **Failed sends** remain visible in the conversation. OpenChat intentionally does not automatically repeat an ambiguous Telegram send because Telegram may have accepted the original request before the response was lost. Check Telegram before sending again.
- **Pending work** is normal briefly. A job stuck in `processing` can be reclaimed after its lease expires; refresh Operations after one minute.

The authenticated `/api/health` endpoint reports database, Telegram, AI-provider, and operations status.

## Database migration

For a new D1 database, apply the numbered SQL files in order. For an installation already running migration `0002`, apply only the new release migration:

```bash
npx wrangler d1 execute openchat --remote --file=drizzle/0003_release_readiness.sql
```

Apply a migration once. Take a Time Travel bookmark first and do not rerun `ALTER TABLE` migrations.

## Backup and restore

Inspect the current remote D1 bookmark before deployment:

```bash
npx wrangler d1 time-travel info openchat
```

Restore by the recorded bookmark when a migration or release must be rolled back:

```bash
npx wrangler d1 time-travel restore openchat --bookmark=<bookmark>
```

This operation changes the remote database. Confirm the target database and bookmark before running it. Restore the matching application version immediately afterward.

## Credential rotation

- Rotate the administrator password by replacing `OPENCHAT_ADMIN_PASSWORD` in the deployed Worker secrets.
- Changing `OPENCHAT_SESSION_SECRET` invalidates sessions and makes dashboard-stored Telegram/OpenRouter credentials undecryptable. Disconnect or record a credential-rotation window before changing it, then reconnect integrations afterward.
- Rotate a Telegram token from BotFather, then replace it in **Settings → Channels**. OpenChat validates the token before saving and reconfigures the webhook.
- Rotate OpenRouter keys from **Settings → AI assistant**. The key is validated and encrypted before the previous saved value is replaced.

Never paste plaintext provider credentials into logs, issues, screenshots, or committed environment files.
