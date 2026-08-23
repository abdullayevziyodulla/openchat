# OpenChat

OpenChat is a self-hosted, open-source Instagram and Telegram inbox that can receive customer messages, let an AI assistant reply with your business knowledge, and hand a conversation to a human at any time.

There is no hosted service, billing system, subscription layer, or telemetry in this repository. You deploy it and keep control of the database and provider credentials.

> **Current status: version 0.2 pre-release.** Telegram and the Instagram implementation are complete in the repository; production use still requires your own Meta App Review approval and live-account acceptance testing.

This repository is a clean self-hosting template: it contains no deployment ID, channel credentials, AI credentials, administrator password, conversation database, or operator identity. Every installation starts with a fresh database and supplies its own runtime configuration.

## What works today

- Password-protected, single-workspace dashboard
- Durable contacts, conversations, messages, settings, and idempotency records in Cloudflare D1
- Authenticated Telegram webhooks with duplicate-update protection
- Dashboard-based Telegram connection with token validation and encrypted credential storage
- Telegram Business secretary mode for messages sent to your profile, with replies sent through that profile
- Real Telegram replies with delivery success/failure state
- Optional OpenRouter automatic replies with encrypted dashboard-managed credentials and model selection
- Private assistant test workspace that previews draft instructions without sending to Telegram or creating inbox records
- Editable assistant instructions and business knowledge
- Durable `AI_ACTIVE`, `ESCALATED`, and `HUMAN_ACTIVE` conversation modes
- Per-conversation durable AI jobs and send leases so stale replies are cancelled and takeover cannot complete while an AI send is in flight
- Recoverable inbound-event processing with failure inspection and manual retry in **Settings → Operations**
- Login throttling for the single-administrator dashboard
- Responsive real-data inbox and contacts views
- Local integration tests using an isolated D1-compatible runtime
- Instagram Login with encrypted long-lived account tokens and multiple-account persistence
- Signed Instagram DM webhooks, unified inbox persistence, human/AI delivery, policy-window enforcement, and token refresh
- Instagram comment and DM keyword automations with durable deduplication, public replies, opening-DM postbacks, follower gates, delayed follow-ups, and next-Reel targeting
- Tracked Instagram link buttons, privacy-preserving click analytics, campaign metrics, failed-run inspection, and resumable manual retries
- Five-minute comment reconciliation for webhook gaps and R2-backed Instagram image/file delivery through short-lived signed URLs

## Architecture

The Worker receives and verifies Telegram updates, durably records and processes them before acknowledging the webhook, and schedules one serialized AI job per conversation. Failed event and AI work remains visible and retryable after restarts. The dashboard only talks to authenticated same-origin endpoints. Telegram credentials entered in Settings are encrypted with a key derived from the installation's session secret before they are stored in D1, and secret values are never returned to the browser.

The code keeps small provider seams:

- `OpenChatStore` owns persistence and conversation state.
- The Telegram and Instagram adapters own provider normalization, webhook setup, and delivery.
- The AI adapter owns OpenAI-compatible generation.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
git clone <your-repository-url>
cd openchat
npm install
cp .env.example .env.local
npm run dev
```

Edit `.env.local` before signing in. At minimum, replace:

```dotenv
OPENCHAT_ADMIN_PASSWORD=choose-a-long-admin-password
OPENCHAT_SESSION_SECRET=generate-at-least-32-random-characters
```

Set `NEXT_PUBLIC_OPENCHAT_REPOSITORY_URL` to the public URL of your fork before publishing the landing page. The example value is intentionally non-operational.

The administrator password must contain at least 12 characters. Use a unique generated value rather than the example text.

Open the local URL printed by the development server, then visit `/dashboard`. Local D1 data is created and migrated automatically.

## Connect Telegram

1. Create a bot with Telegram's `@BotFather` and copy its token.
2. Give the local server a public HTTPS URL using your preferred development tunnel.
3. Open **Dashboard → Settings → Channels**.
4. Paste the bot token and public URL, then select **Connect Telegram**. OpenChat validates the token, generates the webhook secret, encrypts the credentials, and activates the webhook.
5. Message the bot. The conversation should appear in the inbox within a few seconds.

### Telegram Business secretary mode

Secretary mode uses Telegram's connected business bots. Customers message your Telegram profile—not the bot account—and OpenChat can answer through your profile.

1. In `@BotFather`, select the bot and enable **Bot Settings → Business Mode**.
2. In Telegram, open **Settings → Telegram Business → Chatbots**, add the bot, and allow **Reply to messages** for the chats it should handle.
3. Return to **Dashboard → Settings → Channels**. OpenChat receives and displays the connection automatically.

No Telegram user ID is entered manually. Telegram supplies the business connection and account identifiers in the signed webhook update. Human takeover and **Resume AI** work the same way for bot and business-profile conversations.

Advanced deployments may still provide `OPENCHAT_PUBLIC_URL`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET` as runtime secrets. Dashboard-saved credentials take precedence.

OpenChat accepts Telegram text, photos, documents, videos, audio, voice messages, animations, stickers, and captions. Operators can send photos or documents and reply to a specific message from the inbox. Group visibility follows the bot's Telegram privacy-mode configuration.

## Enable AI replies with OpenRouter

Open **Dashboard → Settings → AI assistant**, paste an OpenRouter API key, and choose a model ID. `openrouter/auto` is the simplest default. OpenChat validates the key and model with OpenRouter, encrypts the key, and never returns it to the browser.

Advanced deployments can instead configure an OpenAI-compatible `/chat/completions` endpoint in the server environment:

```dotenv
OPENCHAT_AI_PROVIDER=openrouter
OPENAI_API_KEY=your-openrouter-key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openrouter/auto
```

Dashboard-saved OpenRouter credentials take precedence over environment values. Add business facts and assistant instructions on the same page. If the model lacks the information needed for a safe answer, the prompt tells it to escalate instead of inventing an answer.

Use **Test assistant** on that page to try multi-turn conversations before enabling automation. The tester uses the current on-screen instruction and business-knowledge drafts, including unsaved edits, and does not add test messages to the real inbox.

AI is optional. Without an AI key, OpenChat remains a functional human-operated Instagram and Telegram inbox.

## Connect Instagram

Instagram requires a Meta developer app and an Instagram Business or Creator
account. Configure the installation's Meta app secrets, register the OAuth and
webhook callback URLs shown in **Dashboard → Settings → Channels**, then select
**Connect Instagram**. Connected-account tokens are encrypted in D1.

See [Instagram setup](docs/instagram-setup.md) for the complete Meta dashboard,
testing, permission, and App Review workflow.

## Deploy to Cloudflare

OpenChat's current self-hosting target is Cloudflare Workers + D1.

1. Authenticate Wrangler and create the database:

```bash
npx wrangler login
npx wrangler d1 create openchat
```

2. Copy the returned database ID into your shell environment and apply the migration:

```bash
export OPENCHAT_D1_DATABASE_NAME=openchat
export OPENCHAT_D1_DATABASE_ID=your-d1-database-id
export OPENCHAT_R2_BUCKET_NAME=openchat-media
npx wrangler d1 execute openchat --remote --file=drizzle/0000_openchat.sql
npx wrangler d1 execute openchat --remote --file=drizzle/0001_telegram_business.sql
npx wrangler d1 execute openchat --remote --file=drizzle/0002_telegram_media_replies.sql
npx wrangler d1 execute openchat --remote --file=drizzle/0003_release_readiness.sql
npx wrangler d1 execute openchat --remote --file=drizzle/0004_instagram_foundation.sql
npx wrangler d1 execute openchat --remote --file=drizzle/0005_instagram_automations.sql
npx wrangler d1 execute openchat --remote --file=drizzle/0006_instagram_campaigns.sql
npx wrangler r2 bucket create openchat-media
```

3. Deploy the application:

```bash
npx @vinext/cloudflare deploy
```

4. Using the generated `dist/server/wrangler.json`, add the dashboard password and session secret. The session secret also protects encrypted integration credentials:

```bash
npx wrangler secret put OPENCHAT_ADMIN_PASSWORD --config dist/server/wrangler.json
npx wrangler secret put OPENCHAT_SESSION_SECRET --config dist/server/wrangler.json
npx wrangler secret put INSTAGRAM_APP_ID --config dist/server/wrangler.json
npx wrangler secret put INSTAGRAM_APP_SECRET --config dist/server/wrangler.json
npx wrangler secret put INSTAGRAM_WEBHOOK_VERIFY_TOKEN --config dist/server/wrangler.json
```

After deployment, register the generated Instagram callback/webhook URLs in Meta, then connect Instagram and Telegram from the dashboard. Environment-based Telegram credentials remain available as an advanced fallback. Provider keys must never be committed to the repository.

## Verification

```bash
npm run verify
```

The test suite covers session cookies and login throttling, Telegram and Telegram Business normalization, encrypted credential storage, dashboard setup, recoverable D1 event processing, serialized AI jobs, business-profile delivery, and the human-takeover/send guard. The build command validates the complete Worker and dashboard bundle.

Before tagging a release, complete the [v0.2 release checklist](docs/v0.2-release-checklist.md). Backup, retry, migration, and credential-rotation procedures are in the [operations runbook](docs/operations.md).

Before publishing a fork or handing it to another operator, follow the [public release guide](docs/public-release.md) and run `npm run check:public`. The check rejects tracked deployment IDs, absolute home-directory paths, private keys, and credential-shaped Telegram or OpenAI tokens.

## Known limitations

- Meta App Review, Advanced Access, and live-account validation are external release gates; Development-mode apps can only operate with assigned tester accounts.
- AI work uses a durable D1 job and lease rather than Cloudflare Queues; failed jobs require an operator retry from the Operations screen.
- Telegram message editing, deletion, reactions, media albums, and automatic retry of ambiguous outbound sends are not implemented. Avoiding automatic retries prevents duplicate customer messages when Telegram accepted a request but its response was lost.
- There is one administrator and one workspace per installation.
- Business knowledge is currently a single text field, not document ingestion or semantic retrieval.
- R2 keeps operator-uploaded Instagram attachments until the installation owner applies a bucket lifecycle/retention policy.

See [research/product-readiness.md](research/product-readiness.md) for the broader two-channel roadmap and platform constraints.

## Contributing

Bug reports and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development and privacy rules that apply to public contributions.

## License

OpenChat is licensed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
Selective Instagram provider work is adapted from MIT-licensed OpenReply; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
