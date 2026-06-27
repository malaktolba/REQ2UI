/**
 * Per-request "Bring Your Own Key" (BYOK) override propagation.
 *
 * When a user has configured their own AI provider in Settings, every LLM call
 * made while serving that user's generation must use *their* provider/model/key
 * instead of the built-in system. Rather than thread a credentials argument
 * through the entire pipeline (dozens of functions), we stash the override in an
 * AsyncLocalStorage that the low-level provider entrypoints read transparently.
 *
 * The route handler wraps the generation call in `withLlmOverride(config, fn)`;
 * any callGroq/callGemini entrypoint invoked inside `fn` (at any depth) sees the
 * override via `getLlmOverride()` and routes the call accordingly. Outside a
 * wrapped scope (or when the user hasn't configured BYOK) the store is
 * undefined and the built-in routing runs unchanged.
 *
 * NB: the GEval judge (`callGeminiJudge`) deliberately does NOT consult this —
 * quality evaluation is an internal analytics signal that must always run on the
 * system's own key, never the user's.
 */
import { AsyncLocalStorage } from "async_hooks";

export type LlmProvider = "anthropic" | "openai" | "gemini" | "groq";

export interface UserLlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

const als = new AsyncLocalStorage<UserLlmConfig | undefined>();

/** Run `fn` with `config` active as the LLM override for all nested calls. */
export function withLlmOverride<T>(
  config: UserLlmConfig | undefined,
  fn: () => Promise<T>
): Promise<T> {
  return als.run(config, fn);
}

/** The active user LLM override, or undefined when none is set. */
export function getLlmOverride(): UserLlmConfig | undefined {
  return als.getStore();
}
