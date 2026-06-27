import api from "./axios";

export type AIProvider = "anthropic" | "openai" | "gemini" | "groq";

export interface AISettings {
  configured: boolean;
  enabled: boolean;
  provider: AIProvider | null;
  model: string | null;
  apiKeyMasked: string | null;
}

export async function fetchAISettings(): Promise<{ settings: AISettings; providers: AIProvider[] }> {
  const { data } = await api.get<{ settings: AISettings; providers: AIProvider[] }>("/settings/ai");
  return data;
}

export async function saveAISettings(payload: {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  enabled?: boolean;
}): Promise<AISettings> {
  const { data } = await api.put<{ settings: AISettings }>("/settings/ai", payload);
  return data.settings;
}

export async function deleteAISettings(): Promise<void> {
  await api.delete("/settings/ai");
}

export async function testAISettings(payload: {
  provider?: AIProvider;
  model?: string;
  apiKey?: string;
}): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>("/settings/ai/test", payload);
  return data;
}
