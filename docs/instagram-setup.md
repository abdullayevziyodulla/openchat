# Instagram setup

OpenChat uses Meta's official Instagram API with Instagram Login. It does not
scrape Instagram or ask for an Instagram password. Only Instagram Business and
Creator accounts can connect.

## Runtime configuration

Create a Meta Business app with the **Manage messaging and content on
Instagram** use case. Add these Worker secrets:

```dotenv
INSTAGRAM_APP_ID=your-instagram-app-id
INSTAGRAM_APP_SECRET=your-instagram-app-secret
FACEBOOK_APP_SECRET=your-facebook-app-secret
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=a-long-random-value
META_GRAPH_API_VERSION=v25.0
OPENCHAT_PUBLIC_URL=https://your-openchat.example
```

`FACEBOOK_APP_SECRET` is optional but recommended because Meta may sign a
webhook using either app secret depending on the app configuration. Never put
these values in the repository.

## Meta dashboard URLs

Open **Dashboard → Settings → Channels → Instagram** after deployment. It shows
the exact URLs for the installation. Register:

- OAuth redirect: `https://your-openchat.example/api/instagram/callback`
- Webhook callback: `https://your-openchat.example/webhooks/instagram`

Use the same `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` value when Meta asks for a verify
token. Subscribe the app to `messages`, `messaging_postbacks`, `messaging_seen`,
`message_reactions`, and `comments`. OpenChat also subscribes each connected
professional account through the API.

The requested permissions are:

- `instagram_business_basic`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`

Add the professional account as an Instagram tester and accept the invitation
inside Instagram while the Meta app is in Development mode. Real accounts that
the app owner does not own or manage require Advanced Access and Meta App
Review.

## Connect and verify

1. Open **Dashboard → Settings → Channels**.
2. Select **Connect Instagram** and approve Instagram Login.
3. Confirm the account is shown as **Connected**.
4. Send a DM from a different Instagram account.
5. Confirm the conversation appears in OpenChat and send a human reply.
6. Inspect **Settings → Operations** for failed webhook, AI, or delivery work.

Access tokens are exchanged for long-lived tokens, encrypted with
`OPENCHAT_SESSION_SECRET`, refreshed before expiry, and never returned to the
browser. Changing the session secret makes saved tokens unreadable and requires
reconnecting every account.

Normal AI and human replies must be sent inside Instagram's 24-hour messaging
window. `INSTAGRAM_HUMAN_AGENT_ENABLED=true` may be set only after Meta has
approved the Human Agent permission for this app. OpenChat never applies that
tag to AI-generated messages.

## Campaign automations

Open **Dashboard → Automations** to create either a comment trigger or incoming
DM trigger. A campaign can match any text or Unicode-aware whole-word keywords,
target any post, a selected recent post, or the next Reel published, and can
combine these delivery steps:

- one private reply per eligible comment;
- an optional opening DM whose postback button starts the conversation;
- up to three HTTPS link buttons with first-party click tracking;
- an optional follower check before the reveal;
- an optional public comment reply; and
- an optional delayed follow-up when a DM or postback opened the 24-hour window.

OpenChat fails open when Meta cannot return `is_user_follow_business`; it does
not withhold a promised link based on an unverifiable follower state. Comment
webhooks are reconciled every five minutes using recent media and comments.
Every action is timestamped independently so a retry resumes after the last
confirmed action. If Meta accepted a request but its response was lost, inspect
Instagram before manually retrying because provider delivery is ambiguous.

Tracked links redirect through `/l/:slug`. Only a daily salted hash of the
visitor IP is retained, along with truncated user-agent and referrer metadata;
raw IP addresses are never stored.

## Outbound media

Create an R2 bucket named `openchat-media` (or set
`OPENCHAT_R2_BUCKET_NAME`) and bind it as `MEDIA`. Operator-uploaded Instagram
media is placed in that bucket and exposed to Meta through a ten-minute signed
URL. The dashboard continues to serve the stored attachment through its
authenticated media endpoint after delivery.

## Official references

- [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)
- [Meta Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Instagram private replies](https://www.postman.com/meta/instagram/request/23987686-189d7215-22b3-403f-b2f5-a46c7e66a514)
