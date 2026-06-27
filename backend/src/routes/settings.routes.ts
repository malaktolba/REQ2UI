import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import {
  SUPPORTED_PROVIDERS,
  getMaskedSettings,
  saveSettings,
  deleteSettings,
  getUserLlmConfig,
} from "../services/aiSettings.service";
import { byokPing } from "../services/llm/byok";
import type { LlmProvider, UserLlmConfig } from "../services/llm/context";

const router = Router();
router.use(requireAuth);

const saveSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS as [LlmProvider, ...LlmProvider[]]),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(8).max(400).optional(),
  enabled: z.boolean().optional(),
});

// Test-connection accepts either a freshly entered key (validate before saving)
// or, when apiKey is omitted, falls back to the stored config for this user.
const testSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS as [LlmProvider, ...LlmProvider[]]).optional(),
  model: z.string().min(1).max(120).optional(),
  apiKey: z.string().min(8).max(400).optional(),
});

// GET /api/settings/ai — masked current settings
router.get("/ai", async (req: Request, res: Response): Promise<void> => {
  const settings = await getMaskedSettings(req.user!.sub);
  res.json({ settings, providers: SUPPORTED_PROVIDERS });
});

// PUT /api/settings/ai — create/update settings
router.put("/ai", async (req: Request, res: Response): Promise<void> => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const settings = await saveSettings(req.user!.sub, parsed.data);
    res.json({ settings });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Failed to save settings." });
  }
});

// DELETE /api/settings/ai — remove settings (revert to built-in system)
router.delete("/ai", async (req: Request, res: Response): Promise<void> => {
  await deleteSettings(req.user!.sub);
  res.json({ ok: true });
});

// POST /api/settings/ai/test — verify the provider/model/key works
router.post("/ai/test", async (req: Request, res: Response): Promise<void> => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { provider, model, apiKey } = parsed.data;

  let config: UserLlmConfig | undefined;
  if (provider && model && apiKey) {
    config = { provider, model, apiKey };
  } else {
    // Fall back to the stored (decrypted) config, optionally overriding the model
    // the user just typed without re-entering the key.
    const stored = await getUserLlmConfig(req.user!.sub);
    if (!stored) {
      res.status(400).json({ error: "Enter a provider, model, and API key to test." });
      return;
    }
    config = { ...stored, ...(provider ? { provider } : {}), ...(model ? { model } : {}) };
  }

  try {
    await byokPing(config);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message ?? "Connection test failed." });
  }
});

export default router;
