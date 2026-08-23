ALTER TABLE instagram_automations ADD COLUMN opening_dm_enabled INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN opening_dm_message TEXT;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN opening_dm_button_label TEXT;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN link_button_label TEXT;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN require_follow INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN follow_prompt_message TEXT;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN follow_prompt_button_label TEXT;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN follow_up_enabled INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN follow_up_message TEXT;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN follow_up_delay_minutes INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE instagram_automations ADD COLUMN pending_next_reel INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE instagram_automation_runs ADD COLUMN reveal_sent_at INTEGER;
--> statement-breakpoint
ALTER TABLE instagram_automation_runs ADD COLUMN follow_up_scheduled_at INTEGER;
--> statement-breakpoint
ALTER TABLE instagram_automation_runs ADD COLUMN follow_up_sent_at INTEGER;
--> statement-breakpoint
ALTER TABLE instagram_automation_runs ADD COLUMN last_interaction_at INTEGER;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS instagram_tracked_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL REFERENCES instagram_automations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(automation_id, position)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS instagram_link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_link_id INTEGER NOT NULL REFERENCES instagram_tracked_links(id) ON DELETE CASCADE,
  automation_id INTEGER NOT NULL REFERENCES instagram_automations(id) ON DELETE CASCADE,
  instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_tracked_links_automation ON instagram_tracked_links(automation_id, position);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_link_clicks_automation_created ON instagram_link_clicks(automation_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_runs_follow_up ON instagram_automation_runs(follow_up_scheduled_at, follow_up_sent_at);
--> statement-breakpoint
PRAGMA optimize;
