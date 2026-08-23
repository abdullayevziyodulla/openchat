# OpenChat production launch checklist

Last audited: August 23, 2026

This file is the source of truth for the remaining Cloudflare and Meta launch work. Update the checkboxes as each item is verified. Do not paste passwords, API secrets, access tokens, or production `.env` values into this file.

## Current position

Completed:

- [x] Source checkpoint created at Git commit `4c920de` (`checkpoint: Instagram v0.2 implementation`).
- [x] Dependencies installed successfully with Node.js 22.23.2.
- [x] Local dashboard, authentication, D1 health, and core APIs were started successfully.
- [x] Wrangler 4.92.0 is installed in the project.
- [x] Wrangler is authenticated to the intended Cloudflare account.
- [x] Cloudflare skills and the five Cloudflare MCP servers are installed; protected MCPs show OAuth authenticated.
- [x] Production D1 database `openchat-production` exists.
- [x] R2 is enabled and private bucket `openchat-media-production` exists in EEUR using Standard storage.
- [x] The full verification suite passes: public-release guard, 88 tests, build, lint, and typecheck.
- [x] Production migrations `0000` through `0006` are applied and the resulting schema is verified.
- [x] R2 expires objects under `instagram-outbound/` after 90 days.
- [x] Worker `openchat` is live at `https://openchat.zabdullayev.workers.dev` with the production D1/R2 bindings and both cron triggers.
- [x] `OPENCHAT_PUBLIC_URL` is stored in the Worker secrets.
- [x] Production dashboard authentication is configured with separate admin and session secrets.
- [x] Live dashboard sign-in succeeds with the production admin password.
- [x] Operator-specific Privacy Policy, Terms of Use, and data-deletion instructions are deployed publicly.

Important audit findings:

- The R2 bucket has no public `r2.dev` URL and no custom domain.
- Production authentication is configured, and the live endpoint reports `configured: true`; local-development secrets were not reused.
- `ziyodulla.com` currently uses Porkbun nameservers and is not an active zone in this Cloudflare account, so `openchat.ziyodulla.com` cannot be attached without first migrating the domain's DNS to Cloudflare.
- The current release will keep `openchat.zabdullayev.workers.dev`; `openchat.ziyodulla.com` is deferred for a separate landing page.
- Meta credentials, callback URLs, App Review, and live-account tests are not complete.
- The local ignored D1 database contains an older draft Instagram schema. That local-only state should be recreated before the next local automation test; it does not affect the initialized production D1 database.

## Next action

Configure the Meta app, register the production OAuth/webhook URLs, and store the Meta credentials as Worker secrets.

---

## Step 1 of 8 — Source, legal pages, and preflight

- [x] Create a recoverable Git checkpoint.
- [x] Confirm `.env.local` is ignored by Git.
- [x] Run the public-release safety check.
- [x] Replace the operator placeholders in `app/privacy/page.tsx` with the real operator name, contact, retention policy, AI-provider disclosure, and deletion procedure.
- [x] Replace the operator placeholders in `app/terms/page.tsx`.
- [x] Add a clearly labeled data-deletion section to the public privacy page.
- [x] Run the complete verification suite from Node.js 22:

```powershell
npm run verify
```

Pass condition: tests, build, lint, typecheck, and public-release checks all succeed from the exact commit intended for deployment.

## Step 2 of 8 — Production D1 and R2 resources

- [x] Authenticate Wrangler.
- [x] Verify the Cloudflare account with `npx wrangler whoami`.
- [x] Create D1 database `openchat-production`.
- [x] Enable R2 in the Cloudflare dashboard.
- [x] Create private R2 bucket `openchat-media-production`.
- [x] Confirm no public R2 development URL or R2 custom domain is enabled.
- [x] Add the chosen 90-day attachment-retention rule for `instagram-outbound/`.

Use the project binding name `MEDIA`. Ignore Wrangler's generated suggestion to call the binding `openchat_media_production`; `vite.config.ts` generates the correct `MEDIA` binding during the production build.

After R2 is enabled and the bucket exists:

```powershell
npx wrangler r2 bucket lifecycle add `
  openchat-media-production `
  delete-openchat-outbound-90d `
  "instagram-outbound/" `
  --expire-days 90

npx wrangler r2 bucket lifecycle list openchat-media-production
```

Change `90` before running if the real retention policy differs.

## Step 3 of 8 — Initialize the production D1 database

This is a fresh empty production database. Apply all migrations, not only `0004`–`0006`:

```powershell
$dbName = "openchat-production"

npx wrangler d1 execute $dbName --remote --file="drizzle/0000_openchat.sql"
npx wrangler d1 execute $dbName --remote --file="drizzle/0001_telegram_business.sql"
npx wrangler d1 execute $dbName --remote --file="drizzle/0002_telegram_media_replies.sql"
npx wrangler d1 execute $dbName --remote --file="drizzle/0003_release_readiness.sql"
npx wrangler d1 execute $dbName --remote --file="drizzle/0004_instagram_foundation.sql"
npx wrangler d1 execute $dbName --remote --file="drizzle/0005_instagram_automations.sql"
npx wrangler d1 execute $dbName --remote --file="drizzle/0006_instagram_campaigns.sql"
```

- [x] Apply `0000`.
- [x] Apply `0001`.
- [x] Apply `0002`.
- [x] Apply `0003`.
- [x] Apply `0004`.
- [x] Apply `0005`.
- [x] Apply `0006`.
- [x] Verify the Instagram tables and campaign columns:

```powershell
npx wrangler d1 execute $dbName --remote --command `
  "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"

npx wrangler d1 execute $dbName --remote --command `
  "PRAGMA table_info(instagram_automations);"
```

Do not rerun migration `0006` blindly after a partial failure because it contains `ALTER TABLE ... ADD COLUMN` statements.

## Step 4 of 8 — Build and deploy the Worker

Retrieve the D1 UUID without copying it into this file, then build with the production bindings:

```powershell
$dbName = "openchat-production"
$bucketName = "openchat-media-production"
$database = npx wrangler d1 list --json | ConvertFrom-Json | Where-Object { $_.name -eq $dbName }

if (-not $database) { throw "Production D1 database was not found." }

$env:OPENCHAT_D1_DATABASE_NAME = $dbName
$env:OPENCHAT_D1_DATABASE_ID = $database.uuid
$env:OPENCHAT_R2_BUCKET_NAME = $bucketName

npm run verify
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

- [x] Confirm `dist/server/wrangler.json` binds `DB` to `openchat-production` with a non-placeholder UUID.
- [x] Confirm it binds `MEDIA` to `openchat-media-production`.
- [x] Confirm cron triggers `*/5 * * * *` and `0 3 * * *` exist.
- [x] Upload Worker `openchat` and its static assets.
- [x] Publish its `workers.dev` route and cron triggers.
- [x] Confirm `https://openchat.zabdullayev.workers.dev` and its public legal pages respond over HTTPS.
- [x] Confirm production dashboard authentication and sign-in work.

## Step 5 of 8 — Domain and Worker secrets

- [x] Keep the application on `openchat.zabdullayev.workers.dev`; reserve `openchat.ziyodulla.com` for a separate landing page.
- [x] Confirm HTTPS is active on the `workers.dev` route.
- [ ] Store these through interactive `wrangler secret put` commands against `dist/server/wrangler.json`:

```text
OPENCHAT_ADMIN_PASSWORD
OPENCHAT_SESSION_SECRET
OPENCHAT_PUBLIC_URL
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
FACEBOOK_APP_SECRET
INSTAGRAM_WEBHOOK_VERIFY_TOKEN
META_GRAPH_API_VERSION
```

- [x] Store `OPENCHAT_PUBLIC_URL` as `https://openchat.zabdullayev.workers.dev`.
- [x] Store `OPENCHAT_ADMIN_PASSWORD` securely.
- [x] Store `OPENCHAT_SESSION_SECRET` securely and keep a recovery copy in a password manager.

- [ ] Set `META_GRAPH_API_VERSION` to the version documented by the project (`v25.0`) unless Meta requires a later supported version during setup.
- [ ] Leave `INSTAGRAM_HUMAN_AGENT_ENABLED` unset until Meta separately approves Human Agent.
- [ ] Never rotate `OPENCHAT_SESSION_SECRET` casually; rotating it makes stored integration tokens unreadable and requires reconnecting accounts.

## Step 6 of 8 — Meta development configuration

- [ ] Create/configure the Meta Business app with the **Manage messaging and content on Instagram** use case.
- [ ] Use Instagram Login with exactly these permissions:

```text
instagram_business_basic
instagram_business_manage_messages
instagram_business_manage_comments
```

- [ ] Register OAuth redirect:

```text
https://YOUR-DOMAIN/api/instagram/callback
```

- [ ] Register webhook callback:

```text
https://YOUR-DOMAIN/webhooks/instagram
```

- [ ] Subscribe `messages`, `messaging_postbacks`, `messaging_seen`, `message_reactions`, and `comments`.
- [ ] Add a dedicated Instagram Business or Creator test account to the app roles and accept the invitation.
- [ ] Connect, disconnect, and reconnect it through OpenChat.

## Step 7 of 8 — Meta App Review and Advanced Access

- [x] Make the privacy, terms, and deletion-instructions URLs public.
- [ ] Complete Business Verification if Meta requires it.
- [ ] Request Advanced Access for the three Instagram permissions.
- [ ] Record a reviewer screencast covering OAuth, inbound DM, outbound reply, comment automation, human takeover, and disconnect.
- [ ] Give Meta dedicated temporary reviewer credentials, never personal or production credentials.
- [ ] Request Human Agent separately only for real human support outside the normal window.
- [ ] Switch the Meta app to Live after approval.

## Step 8 of 8 — Live acceptance, release, and GitHub

- [ ] Test an external non-role Instagram professional account after Advanced Access.
- [ ] Test Instagram and Telegram in the unified inbox.
- [ ] Test human text/media replies, AI pause/takeover, and the 24-hour messaging guard.
- [ ] Test comment keyword, any-text, selected-post, any-post, and next-Reel targeting.
- [ ] Test opening postback, follower gate, public reply, three tracked links, analytics, and delayed follow-up.
- [ ] Test missed-comment reconciliation and resumable failure retry.
- [ ] Confirm **Settings → Operations** has no unexplained failures.
- [ ] Rerun `npm run verify` from the release commit.
- [ ] Commit any post-checkpoint fixes.
- [ ] Push `main` to GitHub only after reviewing the final diff.
- [ ] Tag `v0.2.0` only after live acceptance passes.

## Useful status commands

These are read-only:

```powershell
npx wrangler whoami
npx wrangler d1 list --json
npx wrangler r2 bucket list
npx wrangler deployments list --name openchat
codex mcp list
git status --short
git log -2 --oneline --decorate
```

Project-specific references:

- `docs/instagram-setup.md`
- `docs/v0.2-release-checklist.md`
- `docs/operations.md`
- `README.md`

Official references:

- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/r2/reference/wrangler-commands/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
