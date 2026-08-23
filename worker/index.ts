import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleOpenChatRequest, reconcileInstagramComments, refreshDueInstagramTokens } from "../server/openchat";
import type { OpenChatEnv, WorkerContext } from "../server/runtime";

function secureResponse(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (new URL(request.url).protocol === "https:") headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const worker = {
  async fetch(request: Request, env: OpenChatEnv, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);
    const openChatResponse = await handleOpenChatRequest(request, env, ctx);
    if (openChatResponse) return secureResponse(openChatResponse, request);
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return secureResponse(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths), request);
    }
    return secureResponse(await handler.fetch(request, env, ctx), request);
  },
  async scheduled(controller: { cron?: string }, env: OpenChatEnv, ctx: WorkerContext) {
    const reconciliation = reconcileInstagramComments(env);
    ctx.waitUntil(controller.cron === "0 3 * * *"
      ? Promise.all([refreshDueInstagramTokens(env), reconciliation])
      : reconciliation);
  },
};

export default worker;
