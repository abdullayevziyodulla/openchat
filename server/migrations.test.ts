import { afterEach, describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import type { D1Database } from "./runtime";

let miniflare: Miniflare | undefined;

afterEach(async () => {
  await miniflare?.dispose();
  miniflare = undefined;
});

async function migrationDatabase() {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
  });
  return miniflare.getD1Database("DB") as unknown as D1Database;
}

describe("D1 migrations", () => {
  it("applies every checked-in migration in order to a clean database", async () => {
    const database = await migrationDatabase();
    const directory = new URL("../drizzle/", import.meta.url);
    const files = (await readdir(directory)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
    expect(files).toEqual([
      "0000_openchat.sql",
      "0001_telegram_business.sql",
      "0002_telegram_media_replies.sql",
      "0003_release_readiness.sql",
      "0004_instagram_foundation.sql",
      "0005_instagram_automations.sql",
      "0006_instagram_campaigns.sql",
    ]);

    for (const file of files) {
      const sql = await readFile(new URL(file, directory), "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
        await database.prepare(statement).run();
      }
    }

    const { results: eventColumns } = await database.prepare("PRAGMA table_info(channel_events)").all<{ name: string }>();
    expect(eventColumns.map((column) => column.name)).toEqual(expect.arrayContaining(["status", "attempts", "claimed_at", "processed_at", "last_error", "conversation_id"]));
    const { results: tables } = await database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all<{ name: string }>();
    expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining(["ai_jobs", "auth_failures", "telegram_business_connections", "instagram_tracked_links", "instagram_link_clicks"]));
    const { results: indexes } = await database.prepare("SELECT name FROM sqlite_schema WHERE type = 'index'").all<{ name: string }>();
    expect(indexes.map((index) => index.name)).toEqual(expect.arrayContaining(["idx_channel_events_status_received", "idx_ai_jobs_status_updated", "idx_messages_delivery_status"]));
  });
});
