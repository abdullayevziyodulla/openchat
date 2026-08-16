export type D1Value = string | number | null | ArrayBuffer;

export interface D1Result {
  success: boolean;
  error?: string;
  meta: { changes?: number; last_row_id?: number };
}

export interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ success: boolean; results: T[] }>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = D1Result>(statements: D1PreparedStatement[]): Promise<T[]>;
}

export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface OpenChatEnv {
  DB: D1Database;
  ASSETS: AssetFetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  OPENCHAT_ADMIN_PASSWORD?: string;
  OPENCHAT_SESSION_SECRET?: string;
  OPENCHAT_PUBLIC_URL?: string;
  OPENCHAT_TRUST_PLATFORM_AUTH?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  OPENCHAT_AI_PROVIDER?: string;
}

export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
