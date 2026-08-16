# OpenChat product-readiness research

_Checked 2026-08-15 against the repository and current first-party platform documentation. The landing page is intentionally out of scope._

## Bottom line

**The UI runs, but the product described in the README does not work yet.** The repository currently contains a client-side dashboard/demo with hard-coded conversations, local React state, and toast-style placeholder actions. `worker/index.ts` only serves the vinext application and image optimization. There are no channel webhooks or send adapters, authentication, database schema/migrations, queues, real AI calls, encrypted BYOK storage, knowledge retrieval, or production Cloudflare resource bindings.

So the honest status is:

- **Working:** buildable website/dashboard prototype and interaction design.
- **Not working:** real Instagram or Telegram connection, receiving/sending real messages, shared multi-user state, AI automation, human/AI coordination, persistence, analytics, and secure self-hosting.
- **External launch dependency:** a production Instagram integration serving accounts not owned by the app developer needs Meta **Advanced Access** for the relevant permissions; this is not solved by code alone.

## Platform requirements that shape the build

### Instagram

Use the current **Instagram API with Instagram Login** unless there is a specific reason to support the older Facebook Login path.

1. **Only professional accounts are supported.** The API serves Instagram Business and Creator accounts, not consumer/personal accounts. For messaging, OpenChat needs an Instagram user access token plus `instagram_business_basic` and `instagram_business_manage_messages`. A conversation can only begin after the Instagram user has messaged the professional account. Group messaging is not supported. [Meta's official Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
2. **Production access requires review.** Standard Access is sufficient only for professional accounts the app owns/manages and has added in the App Dashboard. Serving customer accounts OpenChat does not own/manage requires Advanced Access, which means implementing the real login/use flow and completing Meta App Review. [Meta Conversations API requirements](https://www.postman.com/meta/instagram/folder/23987686-6a91368f-1fa8-4614-9ed6-7d1e08c21e62)
3. **A robust HTTPS webhook is mandatory.** Meta verifies the callback with `hub.verify_token`/`hub.challenge`; event payloads should be authenticated using the raw request body and `X-Hub-Signature-256`. The endpoint must return `200` within five seconds. Meta retries failed notifications, may deliver duplicates or out of order, and can unsubscribe the account after prolonged failure. Persist by message ID and order by webhook timestamp. [Meta Webhooks documentation](https://www.postman.com/meta/messenger-platform-api/folder/22794852-b5d97624-14d8-4e67-a2e4-529add49ca58)
4. **Subscribe both at app level and per connected account.** At minimum, subscribe each professional account to `messages`; add `messaging_postbacks`, `messaging_seen`, and `message_reactions` if the UI uses those states. Instagram outgoing-message echoes arrive through the `messages` subscription, so ingestion must distinguish inbound messages from `is_echo` events and deduplicate sends. [Meta subscription request](https://www.postman.com/meta/instagram/request/23987686-0223707a-7035-46a2-8015-1fdf7249278f), [Meta messaging webhook payload](https://www.postman.com/meta/instagram/request/23987686-95cce6f6-b811-41dc-b560-d43741c5002a)
5. **The 24-hour window changes automation design.** Normal automated replies belong inside the 24-hour standard messaging window. The `HUMAN_AGENT` tag permits an actual human response for up to seven days, requires the Human Agent permission, and explicitly must not be used for automated messages. “Human takeover” therefore needs both a local atomic AI-paused state and send-time enforcement of Meta's messaging window/tag rules. [Meta HUMAN_AGENT request](https://www.postman.com/meta/instagram/request/23987686-3f06ebc8-c5ad-4b8a-be9f-81acdc79245c)
6. **History is not unlimited.** Conversations in the Requests folder that have been inactive for 30 days are not returned, and shares expose only the shared media URL. OpenChat should store webhook content it is entitled to retain rather than assume the API is a permanent archive. [Meta Conversations API limitations](https://www.postman.com/meta/instagram/folder/23987686-6a91368f-1fa8-4614-9ed6-7d1e08c21e62)
7. **Comment-trigger automations are extra scope.** The landing/demo shows “comment ‘guide’” behavior. Keeping that promise requires `instagram_business_manage_comments`, the `comments` webhook subscription, comment deduplication, and the applicable private-reply flow; messaging permission alone is insufficient. [Meta's official Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)

### Telegram

1. **This is a bot inbox, not access to a user's normal Telegram inbox.** A workspace connects a bot token created through BotFather. The bot receives all messages in private chats with that bot; in groups, Privacy Mode limits what it sees unless the bot is an admin or privacy mode is disabled. [Telegram Bot FAQ](https://core.telegram.org/bots/faq), [Telegram bot features](https://core.telegram.org/bots/features)
2. **Use an authenticated HTTPS webhook.** `setWebhook` and `getUpdates` are mutually exclusive. Configure `secret_token` and verify the `X-Telegram-Bot-Api-Secret-Token` header. Telegram retries non-2xx deliveries; updates are held for no more than 24 hours. Deduplicate on `update_id`. [Telegram Bot API — `setWebhook`](https://core.telegram.org/bots/api#setwebhook)
3. **Respect send limits and 429 responses.** Telegram advises no more than roughly one message/second per chat, 20/minute in a group, and about 30/second for free bulk broadcasts. AI replies should use per-chat serialization plus retry/backoff. [Telegram Bot FAQ — broadcasting limits](https://core.telegram.org/bots/faq#broadcasting-to-users)

### Cloudflare and BYOK

1. **Workers should acknowledge webhooks quickly and enqueue work.** Verify/authenticate the webhook, store an idempotency record, enqueue the event, and return success; do not hold Meta's five-second response open for an LLM call.
2. **D1 fits relational application state, with deliberate tenancy/indexing.** It is intended for persistent structured data and read-heavy web applications, but each database is single-threaded for writes and has a hard 10 GB paid-plan size limit. Design either a small-install single database or a workspace-sharded path, and index provider IDs, conversation recency, unread/status, and idempotency keys. Track schema with D1 migrations and document Time Travel restore procedures. [Cloudflare storage selection](https://developers.cloudflare.com/workers/platform/storage-options/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
3. **Queues are at-least-once.** AI generation, knowledge ingestion, analytics rollups, and outbound delivery should be idempotent. Use event/message IDs as unique keys and configure a dead-letter queue; otherwise exhausted messages are discarded. [Cloudflare Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/), [Cloudflare retry/DLQ behavior](https://developers.cloudflare.com/queues/configuration/batching-retries/)
4. **Durable Objects are optional, not a prerequisite.** They are useful if the product needs strict per-conversation ordering or a WebSocket fan-out coordinator, because an object provides strongly ordered state. A D1 transaction/state flag plus idempotent queue worker is enough for an initial MVP if live updates use polling/SSE. [Cloudflare storage selection](https://developers.cloudflare.com/workers/platform/storage-options/)
5. **Provider and channel credentials must never reach the browser.** Workers secrets are appropriate for installation-wide keys and an encryption/master key. For multi-tenant BYOK, store only encrypted per-workspace credentials, decrypt server-side, redact logs, provide test/rotate/delete actions, and ensure exports/backups do not expose plaintext keys. Cloudflare says not to use plaintext vars for API keys; OpenAI and Google likewise require server-side key handling. [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [OpenAI API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety), [Gemini API key security](https://ai.google.dev/gemini-api/docs/api-key)

## What is left to build, in practical order

### P0 — a real two-channel inbox

- Deployment configuration for Worker routes, D1, Queues/DLQ, optional R2, environment separation, required secrets, and migrations.
- Authentication, sessions, workspace membership/RBAC, invitations, and authorization checks on every workspace-scoped operation.
- Core data model: workspaces, members, channel connections, contacts/identities, conversations, messages, delivery attempts, assignments, tags/stages, notes, and immutable audit events.
- Instagram OAuth/Business Login, token lifecycle and reconnect flow, Advanced Access-ready permission UX, webhook verification/signature validation, per-account subscription, historical conversation sync, Send API adapter, attachment/error handling, echo ingestion, and 24-hour/HUMAN_AGENT enforcement.
- Telegram bot connection and validation, secure token storage, `setWebhook`, secret-header validation, update ingestion, Send API adapter, file handling, rate limiting, retries, and bot disconnect/rotation.
- An idempotent event pipeline: raw-event receipt, normalized channel event, per-conversation ordering, retries, DLQ/replay tooling, outbound delivery state, and reconciliation jobs.
- Replace dashboard fixtures/local state with authenticated APIs and persistent queries. Add live refresh and optimistic composer behavior tied to actual delivery status.
- Human takeover as a durable state machine (`AI_ACTIVE`, `ESCALATED`, `HUMAN_ACTIVE`, resume), with compare-and-set/serialization so queued AI output cannot send after takeover.

### P1 — safe AI automation

- A provider adapter contract for OpenAI, Anthropic, Gemini, OpenRouter, and OpenAI-compatible endpoints, with encrypted BYOK management, provider/model discovery or validation, timeouts, retries, usage/cost metering, and provider-specific errors.
- Knowledge ingestion, chunking, retrieval, source citations, refresh/delete, and tenant isolation. Store documents outside hot message rows; define retention and maximum sizes.
- Prompt/rule versioning, structured model output, escalation rules, confidence/fallback behavior, policy/window checks before send, moderation/guardrails, and an audit trail containing the source/context used for each AI reply.
- A cancellation check immediately before outbound send so takeover wins even when an LLM request was already running.

### P2 — the rest of the README promise

- Workflow builder/runtime and triggers/actions, including loop prevention and schedule/window enforcement.
- Quick replies, searchable contacts, tags/stages/ownership, notes, notification rules, team presence, and conflict-safe shared editing.
- Analytics computed from real immutable events, with clear definitions for “AI resolved,” “qualified,” “handoff,” and “conversion.”
- Admin/operations surfaces: connection health, token expiry, webhook status, queue/DLQ replay, provider health, failed sends, rate limits, data export/deletion, retention controls, backup/restore runbook, and observability/alerts.
- Integration and end-to-end tests using recorded/synthetic webhook payloads, signature/secret rejection tests, duplicate/out-of-order delivery tests, takeover race tests, provider failure tests, and a staging deployment with real test accounts.

## Smallest credible release gate

Call the project functional only when a fresh self-hosting operator can follow documented setup, connect one Telegram bot and one eligible Instagram Professional account, receive and persist a real inbound message from each, have either AI or a human send one reply, take over without a late AI reply escaping, restart/redeploy without losing state, and inspect/retry a failed event. For public Instagram customers, add successful Meta Advanced Access/App Review to that gate.
