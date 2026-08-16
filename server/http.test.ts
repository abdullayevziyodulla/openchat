import { describe, expect, it } from "vitest";
import { createSession, isAuthenticated } from "./http";
import type { OpenChatEnv } from "./runtime";

const env = {
  OPENCHAT_ADMIN_PASSWORD: "correct-horse-battery-staple",
  OPENCHAT_SESSION_SECRET: "a-session-secret-that-is-longer-than-thirty-two-characters",
} as OpenChatEnv;

describe("admin sessions", () => {
  it("rejects weak installation credentials", async () => {
    const response = await createSession(new Request("https://openchat.example/api/auth/login"), {
      OPENCHAT_ADMIN_PASSWORD: "short",
      OPENCHAT_SESSION_SECRET: env.OPENCHAT_SESSION_SECRET,
    } as OpenChatEnv, "short");
    expect(response.status).toBe(503);
  });

  it("rejects a bad password", async () => {
    const response = await createSession(new Request("http://localhost/api/auth/login"), env, "wrong");
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("creates and verifies a signed HttpOnly cookie", async () => {
    const response = await createSession(new Request("https://openchat.example/api/auth/login"), env, env.OPENCHAT_ADMIN_PASSWORD!);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(await isAuthenticated(new Request("https://openchat.example/api/auth/me", { headers: { cookie } }), env)).toBe(true);
  });

  it("only trusts platform identity when explicitly enabled", async () => {
    const request = new Request("https://openchat.example/api/auth/me", { headers: { "oai-authenticated-user-id": "owner-1" } });
    expect(await isAuthenticated(request, {} as OpenChatEnv)).toBe(false);
    expect(await isAuthenticated(request, { OPENCHAT_TRUST_PLATFORM_AUTH: "true" } as OpenChatEnv)).toBe(true);
  });
});
