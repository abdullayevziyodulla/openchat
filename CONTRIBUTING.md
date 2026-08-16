# Contributing to OpenChat

OpenChat accepts focused bug fixes, tests, documentation improvements, and small feature changes that preserve the project's self-hosted design.

## Development

1. Use Node.js 22.13 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and use test-only credentials.
4. Make the smallest cohesive change and add coverage for behavior changes.
5. Run `npm run verify` before opening a pull request.

## Privacy and test data

- Never commit real Telegram updates, chat IDs, usernames, bot tokens, AI keys, administrator credentials, customer messages, database exports, or screenshots of private conversations.
- Use clearly fictional names and non-routable placeholder values in tests and documentation.
- Keep `.env.local`, `.wrangler/`, `dist/`, `.next/`, logs, and exported databases outside commits.
- If a credential enters Git history, revoke it immediately. A later deletion commit is not sufficient.

## Pull requests

Describe the user-facing behavior, the failure mode addressed, and the verification performed. Keep Instagram integration outside the v0.1 scope. Security reports should follow [SECURITY.md](SECURITY.md) instead of being opened publicly.
