import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  fetchAISettings,
  saveAISettings,
  deleteAISettings,
  testAISettings,
  type AIProvider,
  type AISettings,
} from "../api/settings";
import { errorMessage } from "../api/projects";
import { useToast } from "../context/ToastContext";
import { ArrowLeft } from "../components/Icons";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button, Input, Label, Logo, Kicker, Card } from "../components/ui";

// Display metadata + a few model suggestions per provider. The model field is
// free-text — these only seed a datalist; users enter whatever model id their
// account has access to.
const PROVIDERS: {
  id: AIProvider;
  label: string;
  keyHint: string;
  keysUrl: string;
  models: string[];
}[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyHint: "Starts with sk-ant-…",
    keysUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-5-haiku-latest"],
  },
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    keyHint: "Starts with sk-…",
    keysUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"],
  },
  {
    id: "gemini",
    label: "Google (Gemini)",
    keyHint: "Starts with AIza…",
    keysUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  {
    id: "groq",
    label: "Groq",
    keyHint: "Starts with gsk_…",
    keysUrl: "https://console.groq.com/keys",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
];

const FIELD =
  "w-full bg-surface-2 border border-line rounded-lg px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-faint focus:outline-none focus:border-indigo-500/70 " +
  "focus:ring-2 focus:ring-indigo-500/20 transition";

export default function Settings() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [settings, setSettings] = useState<AISettings | null>(null);
  const [provider, setProvider] = useState<AIProvider>("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);

  const meta = PROVIDERS.find((p) => p.id === provider)!;

  useEffect(() => {
    (async () => {
      try {
        const { settings } = await fetchAISettings();
        setSettings(settings);
        if (settings.configured) {
          setProvider(settings.provider ?? "anthropic");
          setModel(settings.model ?? "");
          setEnabled(settings.enabled);
        }
      } catch (err) {
        toast.error(errorMessage(err, "Failed to load settings."));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whether we can submit without a freshly typed key (an existing key is stored).
  const hasStoredKey = !!settings?.configured && !!settings.apiKeyMasked;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!model.trim()) {
      toast.error("Enter a model name.");
      return;
    }
    if (!apiKey.trim() && !hasStoredKey) {
      toast.error("Enter your API key.");
      return;
    }
    setSaving(true);
    try {
      const updated = await saveAISettings({
        provider,
        model: model.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        enabled,
      });
      setSettings(updated);
      setApiKey("");
      toast.success("AI provider settings saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!apiKey.trim() && !hasStoredKey) {
      toast.error("Enter your API key to test.");
      return;
    }
    setTesting(true);
    try {
      await testAISettings({
        provider,
        model: model.trim() || undefined,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      toast.success("Connection successful — your provider is reachable.");
    } catch (err) {
      toast.error(errorMessage(err, "Connection test failed."));
    } finally {
      setTesting(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await deleteAISettings();
      setSettings({ configured: false, enabled: false, provider: null, model: null, apiKeyMasked: null });
      setModel("");
      setApiKey("");
      setEnabled(true);
      toast.success("Removed. Generations will use the built-in AI.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove settings."));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="min-h-screen text-ink flex flex-col">
      <header className="border-b border-line bg-canvas/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/"><Logo size="sm" /></Link>
          <span className="text-faint text-lg font-light">/</span>
          <Link to="/dashboard" className="text-muted hover:text-ink transition text-sm flex items-center gap-1">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <span className="text-faint text-lg font-light">/</span>
          <span className="mono-label text-[10px] text-ink">Settings</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 flex-1 w-full">
        <div className="mb-8">
          <Kicker className="mb-3">settings</Kicker>
          <h1 className="text-3xl font-bold tracking-tight mb-2">AI Provider</h1>
          <p className="text-muted leading-relaxed">
            By default, Req2UI generates everything with its built-in AI — you don't need to
            configure anything. Optionally, connect your own provider and model to run
            generations on your own account and API key.
          </p>
        </div>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {settings?.configured && (
              <div
                className={`text-sm px-4 py-3 rounded-lg border ${
                  settings.enabled
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 light:text-indigo-700"
                    : "bg-surface-2 border-line text-muted"
                }`}
              >
                {settings.enabled ? (
                  <>
                    Active — using <strong>{settings.provider}</strong> ·{" "}
                    <span className="mono-label">{settings.model}</span>
                    {settings.apiKeyMasked && <> · key {settings.apiKeyMasked}</>}
                  </>
                ) : (
                  <>Saved but disabled — generations currently use the built-in AI.</>
                )}
              </div>
            )}

            <Card className="p-5 space-y-5">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value as AIProvider);
                    setModel(""); // model ids differ per provider
                  }}
                  className={FIELD}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  list="model-suggestions"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={`e.g. ${meta.models[0]}`}
                  maxLength={120}
                />
                <datalist id="model-suggestions">
                  {meta.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <p className="mt-1.5 text-xs text-faint">
                  Enter the exact model id from your provider account.
                </p>
              </div>

              <div>
                <Label htmlFor="apiKey">API key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    hasStoredKey ? `Saved (${settings?.apiKeyMasked}) — leave blank to keep` : meta.keyHint
                  }
                  maxLength={400}
                />
                <p className="mt-1.5 text-xs text-faint">
                  Stored encrypted and never shown again.{" "}
                  <a
                    href={meta.keysUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Get a {meta.label.split(" ")[0]} key
                  </a>
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-indigo-500"
                />
                <span className="text-sm text-ink">
                  Use my provider for generations
                  <span className="text-faint"> — uncheck to keep the key but fall back to built-in AI</span>
                </span>
              </label>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={handleTest} disabled={testing}>
                {testing ? "Testing…" : "Test connection"}
              </Button>
              {settings?.configured && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleRemove}
                  disabled={removing}
                  className="ml-auto"
                >
                  {removing ? "Removing…" : "Remove"}
                </Button>
              )}
            </div>
          </form>
        )}
      </main>

      <footer className="border-t border-line py-6 text-center mono-label text-[10px] text-faint">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
