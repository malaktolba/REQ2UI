/**
 * User AI-provider (BYOK) settings: persistence + safe accessors.
 *
 * Stores one row per user in `user_ai_settings` with the API key encrypted at
 * rest. Two read paths:
 *   - `getUserLlmConfig`  → decrypted config for the pipeline (server-internal,
 *                           returns undefined when not configured or disabled).
 *   - `getMaskedSettings` → client-safe view; the key is never returned in full.
 */
import { sql } from "../db/client";
import { encryptSecret, decryptSecret, maskKey } from "./llm/crypto";
import type { LlmProvider, UserLlmConfig } from "./llm/context";

export const SUPPORTED_PROVIDERS: LlmProvider[] = ["anthropic", "openai", "gemini", "groq"];

export interface MaskedSettings {
  configured: boolean;
  enabled: boolean;
  provider: LlmProvider | null;
  model: string | null;
  apiKeyMasked: string | null;
}

/** Decrypted config for generation, or undefined when BYOK is off/unconfigured. */
export async function getUserLlmConfig(userId: string): Promise<UserLlmConfig | undefined> {
  const rows = (await sql`
    SELECT provider, model, api_key_enc, enabled
    FROM user_ai_settings WHERE user_id = ${userId}
  `) as any[];
  if (!rows.length || !rows[0].enabled) return undefined;
  const r = rows[0];
  try {
    return { provider: r.provider, model: r.model, apiKey: decryptSecret(r.api_key_enc) };
  } catch {
    // A decrypt failure (e.g. the server secret changed) shouldn't break
    // generation — fall back to the built-in system instead.
    return undefined;
  }
}

/** Client-safe settings view (masked key, never the plaintext). */
export async function getMaskedSettings(userId: string): Promise<MaskedSettings> {
  const rows = (await sql`
    SELECT provider, model, api_key_enc, enabled
    FROM user_ai_settings WHERE user_id = ${userId}
  `) as any[];
  if (!rows.length) {
    return { configured: false, enabled: false, provider: null, model: null, apiKeyMasked: null };
  }
  const r = rows[0];
  let masked: string | null = null;
  try {
    masked = maskKey(decryptSecret(r.api_key_enc));
  } catch {
    masked = null;
  }
  return {
    configured: true,
    enabled: r.enabled,
    provider: r.provider,
    model: r.model,
    apiKeyMasked: masked,
  };
}

export interface SaveSettingsInput {
  provider: LlmProvider;
  model: string;
  apiKey?: string; // optional on update: omit to keep the stored key
  enabled?: boolean;
}

/**
 * Upsert a user's BYOK settings. On first configuration `apiKey` is required;
 * on update it may be omitted to keep the existing encrypted key (e.g. when only
 * the model or the enabled flag changes).
 */
export async function saveSettings(userId: string, input: SaveSettingsInput): Promise<MaskedSettings> {
  if (!SUPPORTED_PROVIDERS.includes(input.provider)) {
    throw new Error(`Unsupported provider: ${input.provider}`);
  }
  if (!input.model || !input.model.trim()) {
    throw new Error("A model name is required.");
  }

  const existing = (await sql`
    SELECT api_key_enc FROM user_ai_settings WHERE user_id = ${userId}
  `) as any[];

  let apiKeyEnc: string;
  if (input.apiKey && input.apiKey.trim()) {
    apiKeyEnc = encryptSecret(input.apiKey.trim());
  } else if (existing.length) {
    apiKeyEnc = existing[0].api_key_enc;
  } else {
    throw new Error("An API key is required.");
  }

  const enabled = input.enabled ?? true;

  await sql`
    INSERT INTO user_ai_settings (user_id, provider, model, api_key_enc, enabled, updated_at)
    VALUES (${userId}, ${input.provider}, ${input.model.trim()}, ${apiKeyEnc}, ${enabled}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      provider    = EXCLUDED.provider,
      model       = EXCLUDED.model,
      api_key_enc = EXCLUDED.api_key_enc,
      enabled     = EXCLUDED.enabled,
      updated_at  = NOW()
  `;

  return getMaskedSettings(userId);
}

/** Remove a user's BYOK settings (revert to the built-in system). */
export async function deleteSettings(userId: string): Promise<void> {
  await sql`DELETE FROM user_ai_settings WHERE user_id = ${userId}`;
}
