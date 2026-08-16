ALTER TABLE messages ADD COLUMN attachment_json TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN reply_to_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
--> statement-breakpoint
PRAGMA optimize;
