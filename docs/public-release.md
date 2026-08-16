# Public release guide

Use this guide before publishing a fork, transferring the project, or creating a production installation. A source repository and a running installation have different privacy boundaries: cleaning one does not clean the other.

## Source repository

1. Start from a clean checkout and run `npm ci`.
2. Copy `.env.example` to `.env.local`; never commit the resulting file.
3. Set `NEXT_PUBLIC_OPENCHAT_REPOSITORY_URL` to the URL of the public fork.
4. Replace the operator placeholders in the Privacy and Terms pages if the fork will run as a public service.
5. Run `npm run check:public`, then `npm run verify`.
6. Inspect `git status --ignored` before committing. Local D1 files under `.wrangler/`, build output, logs, and environment files must remain ignored.
7. Scan the complete Git history before pushing. Removing a secret from the latest commit does not remove it from older commits; rotate any exposed credential and rewrite history when necessary.

## Fresh installation

1. Create a new D1 database. Never copy a development database that contains real conversations.
2. Generate a unique administrator password and a new session secret of at least 32 random characters.
3. Deploy first, then add secrets through the hosting provider. Do not place secrets in `.openai/hosting.json` or tracked source files.
4. Sign in and connect a bot created for this installation. Do not reuse a personal or staging bot in a public deployment.
5. Replace the Privacy and Terms pages with notices appropriate for the installation and its jurisdiction.
6. Complete `docs/v0.1-release-checklist.md` before tagging or announcing the release.

## Removing an old installation

1. Disable or delete the Telegram webhook before discarding the bot token.
2. Rotate or revoke the Telegram and AI credentials.
3. Delete the hosted environment variables and database, following the hosting provider's retention controls.
4. Remove local `.env.local`, `.wrangler/`, build output, logs, screenshots, and exported database files.
5. Verify that backups, deployment snapshots, and Git history do not retain data that must be deleted.
