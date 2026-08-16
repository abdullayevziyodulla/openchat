# Telegram message capabilities for OpenChat

Research date: 2026-08-15. Sources are limited to Telegram's official first-party documentation. The current Bot API reference identifies itself as Bot API 10.2.

## Decision summary

OpenChat can support photos, documents, audio, video, voice notes, stickers, albums, native replies, captions, editing, deletion, typing/upload indicators, and several other Telegram message types. The same major send methods accept `business_connection_id`, so most of this can work both in an ordinary bot inbox and in Secretary Mode. The practical exception is reactions: `setMessageReaction` has no `business_connection_id`, and Telegram's first-party list of actions allowed over a business connection does not include reactions. Therefore reaction sending should be treated as ordinary-bot-only unless Telegram adds explicit Business support.

The recommended MVP order is:

1. Preserve and render incoming attachments.
2. Upload/send photos and documents with optional captions.
3. Add native reply-to-message for text and attachments.
4. Add audio, voice, video, stickers, and albums.
5. Add edit/delete/read-state/typing controls.
6. Add ordinary-bot reactions and lower-priority Telegram-native message types.

## Capability matrix

| Capability | Ordinary bot chat | Secretary Mode | Important implementation note |
| --- | --- | --- | --- |
| Receive photos/files/media | Yes | Yes | Updates expose media-specific fields and `file_id`; Secretary Mode uses `business_message` and related updates. |
| Send photo/document | Yes | Yes | `sendPhoto` and `sendDocument` accept `business_connection_id`, caption, and `reply_parameters`. |
| Send audio/video/voice/sticker | Yes | Yes | The corresponding send methods accept `business_connection_id`. |
| Reply to a specific message | Yes | Yes | Pass `reply_parameters.message_id`; cross-chat replies are not supported for business-account sends. |
| Edit text/caption/media | Own bot messages | Yes, within Business rules | Business edit methods accept `business_connection_id`; some Business messages not sent by the bot have a 48-hour restriction. |
| Delete messages | Subject to bot/admin rules | Yes, if granted delete rights | Use `deleteBusinessMessages` in Secretary Mode and check connection rights first. |
| Mark incoming message read | Not a normal private-bot action | Yes, if `can_read_messages` | `readBusinessMessage` also requires the chat to have been active in the last 24 hours. |
| Send typing/upload state | Yes | Yes | `sendChatAction` accepts `business_connection_id`. |
| Add a reaction | Yes, within reaction rules | Not exposed by current Business API | `setMessageReaction` lacks `business_connection_id`; hide this action in Secretary Mode. |
| Albums | Yes | Yes | `sendMediaGroup` accepts 2-10 items and `business_connection_id`. |
| Inline keyboards/callbacks | Yes | Yes | First-party Business docs explicitly allow inline keyboards and Business callback queries. |

Sources: [Message and incoming update types](https://core.telegram.org/bots/api#message), [Secretary Bots overview](https://core.telegram.org/bots/features#secretary-bots), [connected-business actions](https://core.telegram.org/api/bots/connected-business-bots), and the individual methods linked below.

## Inbound photos, documents, and other media

An incoming `Message` can contain `photo`, `document`, `animation`, `audio`, `video`, `video_note`, `voice`, or `sticker`, plus an optional `caption`; `photo` is an array of available `PhotoSize` variants, while the other media objects expose a reusable/downloadable `file_id`. Telegram describes a regular `Update.message` as a new message "of any kind" and exposes separate `business_message`, `edited_business_message`, and `deleted_business_messages` update fields. [Message fields](https://core.telegram.org/bots/api#message) [Update fields](https://core.telegram.org/bots/api#update)

Implementation implications:

- Model a message as text plus zero or more attachments, not as text alone.
- Accept media-only messages; use a UI fallback such as `Photo`, `Document`, or `Voice message` for the conversation preview when there is no caption.
- Persist the Telegram media kind, `file_id`, `file_unique_id`, MIME type, filename, byte size, dimensions/duration when present, caption, and the numeric Telegram `message_id`.
- For photos, select a display variant by dimensions/file size and retain all returned variants if later download-quality selection matters.
- Preserve `media_group_id` so an incoming album can be grouped rather than rendered as unrelated messages. [Message fields](https://core.telegram.org/bots/api#message)

Telegram says Secretary Bots receive the Bot API updates supported in the chats the owner allowed, except messages sent by the Secretary Bot itself and other bots. A Secretary implementation must process Business connection changes plus `business_message`, `edited_business_message`, and `deleted_business_messages`. [Secretary Bots](https://core.telegram.org/bots/features#secretary-bots)

### Download flow and limits

Call `getFile(file_id)`, then download `https://api.telegram.org/file/bot<token>/<file_path>`. On Telegram's hosted Bot API, the download limit is currently 20 MB, and the generated link is guaranteed for at least one hour; call `getFile` again after expiry. Telegram warns that `getFile` may not preserve the original filename or MIME type, so save them from the original media object. [getFile](https://core.telegram.org/bots/api#getfile) [File](https://core.telegram.org/bots/api#file)

Because the download URL contains the bot token, OpenChat should fetch/proxy it server-side or issue its own short-lived authenticated attachment URL; never send Telegram's raw file URL to the browser. This is an implementation inference from Telegram's documented URL format.

If OpenChat later needs larger inbound downloads, Telegram's official local Bot API server removes the download-size limit and raises uploads to 2,000 MB. This is infrastructure-heavy and should not be part of the first hosted MVP. [Local Bot API Server](https://core.telegram.org/bots/api#using-a-local-bot-api-server)

## Outbound media and uploads

Telegram offers three ways to send files:

1. Reuse an existing Telegram `file_id` (Telegram documents no size limit for this route).
2. Supply an HTTP URL (maximum 5 MB for photos and 20 MB for other content).
3. Upload using `multipart/form-data` (maximum 10 MB for photos and 50 MB for other files).

[Sending files](https://core.telegram.org/bots/api#sending-files)

OpenChat should implement multipart upload first for new local files and reuse stored `file_id` values when resending a Telegram-hosted attachment. The existing JSON-only Bot API helper will need a multipart branch; file uploads cannot use `application/json`. [Making requests](https://core.telegram.org/bots/api#making-requests)

### Photos and documents

- `sendPhoto` accepts an uploaded file, HTTP URL, or `file_id`, a 0-1024-character caption, formatted caption entities, spoiler/placement options, `reply_parameters`, and `business_connection_id`. Direct uploads are limited to 10 MB, with Telegram-specific dimension/aspect constraints. [sendPhoto](https://core.telegram.org/bots/api#sendphoto)
- `sendDocument` accepts arbitrary file types up to 50 MB, the same three file-source choices, a 0-1024-character caption, `reply_parameters`, and `business_connection_id`. Telegram currently restricts URL-based document sending to PDF and ZIP, so direct multipart upload is more predictable. [sendDocument](https://core.telegram.org/bots/api#senddocument) [URL notes](https://core.telegram.org/bots/api#sending-files)

### Audio, voice, video, animation, stickers, and albums

- `sendAudio` produces the music-player treatment for MP3/M4A files and currently accepts up to 50 MB. [sendAudio](https://core.telegram.org/bots/api#sendaudio)
- `sendVoice` produces a voice-message bubble for OGG/OPUS, MP3, or M4A and currently accepts up to 50 MB. [sendVoice](https://core.telegram.org/bots/api#sendvoice)
- `sendVideo` gives Telegram's native video treatment for MPEG-4; other formats can be sent as documents. The current limit is 50 MB. [sendVideo](https://core.telegram.org/bots/api#sendvideo)
- `sendVideoNote` sends Telegram's round video-message format. [sendVideoNote](https://core.telegram.org/bots/api#sendvideonote)
- `sendAnimation` supports GIF or silent H.264/MPEG-4 AVC animation up to 50 MB. [sendAnimation](https://core.telegram.org/bots/api#sendanimation)
- `sendSticker` supports static WEBP, animated TGS, and video WEBM stickers. [sendSticker](https://core.telegram.org/bots/api#sendsticker)
- `sendMediaGroup` sends 2-10 audio, document, live-photo, photo, or video items and accepts both `business_connection_id` and `reply_parameters`. [sendMediaGroup](https://core.telegram.org/bots/api#sendmediagroup)

All of the individual media methods above expose `business_connection_id` in the current Bot API, so OpenChat can use one attachment composer for both modes and add the connection ID only for `telegram_business` conversations. Most caption-bearing methods cap captions at 1,024 characters after entity parsing. Stickers and video notes do not use captions, so the composer should send separately entered text as another message for those types.

## Native reply-to-message

Telegram exposes the original same-chat message as inbound `Message.reply_to_message`. For outgoing replies, the send methods accept `reply_parameters`; its `message_id` identifies the target, and it optionally supports a precise quoted substring up to 1,024 characters, quote entities, and quote position. [Message reply fields](https://core.telegram.org/bots/api#message) [ReplyParameters](https://core.telegram.org/bots/api#replyparameters)

Recommended UI/data flow:

1. Each bubble gets a Reply action.
2. The composer shows a dismissible preview of the target author and text/media type.
3. Persist `reply_to_external_message_id` on the local outgoing message.
4. Send `reply_parameters: { message_id: <numeric Telegram ID> }` with text or media.
5. Render inbound replies from `reply_to_message` even if the referenced message is outside the local history window.

For Secretary Mode, include `business_connection_id` in the send request. Do not set `ReplyParameters.chat_id`: Telegram explicitly says cross-chat replies are unsupported for messages sent on behalf of a business account. Telegram also defines `allow_sending_without_reply` as always true for Business sends, so a deleted/stale reply target should not prevent the reply from being sent. [ReplyParameters](https://core.telegram.org/bots/api#replyparameters)

## Editing and deletion

Telegram provides `editMessageText`, `editMessageCaption`, and `editMessageMedia`, each with `business_connection_id`. Media editing supports animation, audio, document, live photo, photo, and video, with album-type restrictions. Telegram notes that Business messages not sent by the bot and lacking an inline keyboard can only be edited within 48 hours. [editMessageText](https://core.telegram.org/bots/api#editmessagetext) [editMessageCaption](https://core.telegram.org/bots/api#editmessagecaption) [editMessageMedia](https://core.telegram.org/bots/api#editmessagemedia)

For deletion:

- Normal `deleteMessage` is generally limited to messages sent less than 48 hours ago and varies with private-chat/admin rights. `deleteMessages` handles 1-100 messages using the same restrictions. [deleteMessage](https://core.telegram.org/bots/api#deletemessage) [deleteMessages](https://core.telegram.org/bots/api#deletemessages)
- Secretary Mode should use `deleteBusinessMessages`. Deleting bot-sent messages requires `can_delete_sent_messages`; deleting any managed private message requires `can_delete_all_messages`. The method accepts 1-100 message IDs from one chat and still refers to the standard deletion limitations. [Business rights](https://core.telegram.org/bots/api#businessbotrights) [deleteBusinessMessages](https://core.telegram.org/bots/api#deletebusinessmessages)

OpenChat should initially show Edit/Delete only on messages that its bot sent and only when the required Business right is present. Support for editing/deleting messages authored manually by the Business owner can be added after their audit semantics are designed.

## Reactions

For ordinary bot chats, `setMessageReaction` can set or clear the bot's chosen reaction. A non-Premium bot may set up to one reaction per message; paid reactions are unavailable, and a custom emoji is allowed only if already present or explicitly permitted by chat administrators. [setMessageReaction](https://core.telegram.org/bots/api#setmessagereaction)

Reaction-update subscriptions are more restrictive: `message_reaction` and `message_reaction_count` are excluded from default updates, must be explicitly included in `allowed_updates`, and the bot must be an administrator in the chat. Telegram also says updates are not emitted for reactions set by bots. [Update](https://core.telegram.org/bots/api#update)

Secretary Mode caveat: `setMessageReaction` has no `business_connection_id`, and Telegram's official connected-business method list includes send/edit/delete/read/typing/pin operations but not reaction operations. The safe product behavior is to hide reaction controls for `telegram_business` conversations. This conclusion is an inference from the two official API surfaces, not an explicit sentence saying “Business reactions are forbidden.” [setMessageReaction](https://core.telegram.org/bots/api#setmessagereaction) [connected-business methods](https://core.telegram.org/api/bots/connected-business-bots)

## Business connection rights and 24-hour scope

Always cache the latest `BusinessConnection`, check `is_enabled`, and gate operations by its rights. `can_reply` means the bot may send and edit messages in private chats that had incoming messages in the last 24 hours. Separate rights cover reading, deleting bot-sent messages, and deleting all managed private messages. [BusinessConnection](https://core.telegram.org/bots/api#businessconnection) [BusinessBotRights](https://core.telegram.org/bots/api#businessbotrights)

Useful Secretary features beyond media:

- `readBusinessMessage` marks incoming messages read when `can_read_messages` is granted and the chat was active within 24 hours. [readBusinessMessage](https://core.telegram.org/bots/api#readbusinessmessage)
- `sendChatAction` supports `typing`, `upload_photo`, `upload_video`, `upload_voice`, `upload_document`, `choose_sticker`, and other native activity states, and accepts `business_connection_id`. [sendChatAction](https://core.telegram.org/bots/api#sendchataction)
- Pin/unpin methods accept `business_connection_id`; the low-level Business API lists message pinning among allowed operations. [pinChatMessage](https://core.telegram.org/bots/api#pinchatmessage) [connected-business methods](https://core.telegram.org/api/bots/connected-business-bots)
- Business-sent messages may contain inline keyboards, with button presses delivered as Business callback queries. [Connected business bots](https://core.telegram.org/api/bots/connected-business-bots)
- Location, venue, contact, poll, dice, game, and checklist sends are exposed by the Bot API; the common send methods include Business connection support. These are lower-value than attachments/replies for a support inbox. [Available Bot API methods](https://core.telegram.org/bots/api#available-methods)

## Recommended delivery sequence

### Phase 1 — receive and display media

- Expand Telegram payload typing/normalization for photo, document, audio, video, animation, voice, video note, sticker, caption, media group, and inbound reply metadata.
- Add attachment persistence and authenticated server-side download/proxying.
- Render safe image previews plus download cards; for unsupported or over-20-MB downloads, show metadata and an honest “too large to download through Telegram Bot API” state.
- Add tests for media-only ordinary and Business messages, captions, albums, and oversize/missing file metadata.

### Phase 2 — photo/document sending and replies

- Generalize the Bot API transport to support multipart bodies without manually setting the multipart `Content-Type` boundary.
- Add paperclip/file-picker UX with preview, remove, upload progress, retry, validation, and optional caption.
- Add `sendPhoto`/`sendDocument`, passing `business_connection_id` for Secretary conversations.
- Add the Reply action and `reply_parameters` to both text and attachment sends.

This phase answers the highest-value user request: “Can I reply with a photo/file and reply to a specific message?”

### Phase 3 — richer media

- Add video, audio, voice, animation, stickers, and albums.
- Choose `sendVoice` only for a deliberate voice-note experience; use `sendAudio` for tracks and `sendDocument` as a fallback for incompatible formats.
- Add media-type-specific validation before upload so failures are shown locally.

### Phase 4 — message controls

- Add `sendChatAction` while uploads or AI generation take noticeable time.
- Add Edit/Delete for bot-authored messages, gated by age and Business rights.
- Optionally mark Business messages read after the operator opens the conversation, gated by `can_read_messages`.
- Consume `edited_message`, `edited_business_message`, and deletion updates so OpenChat stays in sync with Telegram.

### Phase 5 — reactions and Telegram-native extras

- Add `setMessageReaction` only for ordinary bot conversations; do not promise incoming private-chat reaction synchronization.
- Add inline keyboards, contact/location, polls, pinning, or other native types only when a concrete support workflow calls for them.

## Product guardrails

- Capability-gate the composer per channel/mode instead of presenting controls that will fail.
- Enforce Telegram size/format limits before upload and retain Telegram's returned error text for diagnosis.
- Never expose the bot token or token-bearing download URL to the browser or logs.
- Keep durable status for pending/uploading/sent/failed messages so retries do not create confusing duplicates.
- For Secretary Mode, re-check the latest connection and rights after Telegram returns an authorization error; connection settings can change after a conversation was opened.
