import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const { d1, r2 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const runtimeVariableNames = [
  "OPENCHAT_ADMIN_PASSWORD",
  "OPENCHAT_SESSION_SECRET",
  "OPENCHAT_PUBLIC_URL",
  "OPENCHAT_TRUST_PLATFORM_AUTH",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET",
  "FACEBOOK_APP_SECRET",
  "INSTAGRAM_WEBHOOK_VERIFY_TOKEN",
  "META_GRAPH_API_VERSION",
  "INSTAGRAM_HUMAN_AGENT_ENABLED",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
] as const;

export default defineConfig(async ({ mode }) => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const loadedEnvironment = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const localRuntimeVariables = Object.fromEntries(runtimeVariableNames.flatMap((name) => loadedEnvironment[name] ? [[name, loadedEnvironment[name]]] : []));
  const d1DatabaseId = loadedEnvironment.OPENCHAT_D1_DATABASE_ID || SITE_CREATOR_PLACEHOLDER_DATABASE_ID;
  const d1DatabaseName = loadedEnvironment.OPENCHAT_D1_DATABASE_NAME || "openchat";
  const mediaBucketName = loadedEnvironment.OPENCHAT_R2_BUCKET_NAME || "openchat-media";
  const localBindingConfig = {
    main: "./worker/index.ts",
    compatibility_flags: ["nodejs_compat"],
    vars: mode === "development" ? localRuntimeVariables : {},
    triggers: { crons: ["*/5 * * * *", "0 3 * * *"] },
    d1_databases: d1 ? [{ binding: d1, database_name: d1DatabaseName, database_id: d1DatabaseId }] : [],
    r2_buckets: r2 ? [{ binding: r2, bucket_name: mediaBucketName }] : [],
  };
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    server: {
      allowedHosts: [".lhr.life", ".trycloudflare.com"],
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }, config: localBindingConfig }),
    ],
  };
});
