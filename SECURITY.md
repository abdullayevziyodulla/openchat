# Security policy

OpenChat is alpha software. Do not expose an installation to real customer traffic until you have reviewed its configuration, access controls, retention needs, and provider policies.

## Reporting a vulnerability

Please report security issues privately to the repository owner instead of opening a public issue. Include the affected version, reproduction steps, impact, and any suggested mitigation.

## Deployment requirements

- Use a unique, long admin password and at least 32 random characters for `OPENCHAT_SESSION_SECRET`.
- Store Telegram and AI credentials as runtime secrets. Never commit `.env.local` or copy credentials into browser code.
- Serve production installations over HTTPS.
- Keep the dashboard private at the network layer when possible.
- Only enable `OPENCHAT_TRUST_PLATFORM_AUTH` when the hosting layer is owner-only and guarantees the forwarded authenticated-user header.
- Rotate a credential immediately if it appears in a log, commit, screenshot, or issue.
- Back up D1 and test restoration before relying on OpenChat for customer history.

The application sets HttpOnly, SameSite cookies, verifies same-origin mutations, authenticates Telegram webhooks, bounds webhook payload size, and stores idempotency keys for received Telegram updates.
