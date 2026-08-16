const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface OpenRouterResponse<T> {
  data?: T;
  error?: { message?: string };
}

async function openRouterGet<T>(path: string, apiKey: string, timeout = 12_000) {
  const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeout),
  });
  const payload = await response.json() as OpenRouterResponse<T>;
  if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? `OpenRouter returned HTTP ${response.status}`);
  return payload.data;
}

export async function inspectOpenRouterKey(apiKey: string) {
  const data = await openRouterGet<{ label?: string; limit_remaining?: number | null; is_free_tier?: boolean }>("/key", apiKey);
  return {
    label: data.label ?? "OpenRouter API key",
    limitRemaining: typeof data.limit_remaining === "number" ? data.limit_remaining : null,
    freeTier: Boolean(data.is_free_tier),
  };
}

export async function inspectOpenRouterModel(apiKey: string, model: string) {
  const normalized = model.trim();
  if (normalized.length > 200 || !/^~?[A-Za-z0-9._-]+\/[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error("Enter a valid OpenRouter model ID such as openrouter/auto.");
  }
  const data = await openRouterGet<{ id?: string; name?: string }>(`/model/${normalized}`, apiKey);
  if (!data.id) throw new Error("OpenRouter returned an invalid model.");
  return { id: data.id, name: data.name ?? data.id };
}

export async function listOpenRouterModels(apiKey: string) {
  type ModelRow = { id?: string; name?: string; context_length?: number };
  const data = await Promise.any([
    openRouterGet<ModelRow[]>("/models/user", apiKey, 25_000),
    openRouterGet<ModelRow[]>("/models", apiKey, 25_000),
  ]);
  const models = data
    .filter((model): model is { id: string; name?: string; context_length?: number } => Boolean(model.id && model.id.length <= 200))
    .slice(0, 600)
    .map((model) => ({
      id: model.id,
      name: model.name?.trim() || model.id,
      contextLength: typeof model.context_length === "number" ? model.context_length : null,
    }));
  if (!models.some((model) => model.id === "openrouter/auto")) {
    models.unshift({ id: "openrouter/auto", name: "Auto Router", contextLength: null });
  }
  return models;
}
