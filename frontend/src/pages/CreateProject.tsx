import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createProject, errorMessage } from "../api/projects";
import type { ProjectMetadata, UIPreferences } from "../types/project";
import { useToast } from "../context/ToastContext";
import { ArrowLeft, ChevronDown } from "../components/Icons";
import { ThemeToggle } from "../components/ThemeToggle";
import { UIPreferencesForm, UIPreferencesSummary } from "../components/UIPreferencesForm";
import { cleanPreferences, summarizePreferences } from "../config/uiPreferences";
import { Button, Input, Textarea, Label, Logo, Kicker } from "../components/ui";

// Worked examples that demonstrate good input: each fills in a project name and
// a detailed, multi-faceted description (purpose, users, features, constraints)
// so the pipeline has rich material to work with — not a one-line teaser.
type ExamplePrompt = {
  emoji: string;
  title: string;
  tagline: string;
  name: string;
  description: string;
  meta: ProjectMetadata;
  prefs: UIPreferences;
};

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    emoji: "🎓",
    title: "Student Portal",
    tagline: "University attendance & grades",
    name: "Campus Connect",
    description:
      "A web and mobile portal for university students, professors, and academic administrators. " +
      "Students view their class schedule, check in to lectures via a time-limited QR code, track attendance percentages per course, and see grades as they are posted. " +
      "Professors take attendance, upload grades, and send announcements that notify enrolled students by push and email. " +
      "Administrators manage courses, enrollments, and academic terms. " +
      "Requirements: role-based access (student/professor/admin), an attendance threshold that flags at-risk students below 75%, GPA calculation, and exportable attendance reports. " +
      "Constraints: must support 10,000 concurrent users during enrollment week, comply with FERPA for student records, and work offline for attendance check-in with later sync.",
    meta: {
      organization: "State University",
      industry: "Education",
      audience: "Students, professors, and academic administrators",
      version: "1.0",
    },
    prefs: {
      theme: "mobile-app",
      color_mode: "light",
      layout_density: "balanced",
      navigation: "bottom",
      content_style: "cards",
      button_style: "rounded",
      card_style: "elevated",
      animations: "subtle",
    },
  },
  {
    emoji: "🛍️",
    title: "Marketplace",
    tagline: "Handmade-crafts e-commerce",
    name: "Artisan Market",
    description:
      "A two-sided e-commerce marketplace for independent makers to sell handmade crafts to buyers. " +
      "Sellers onboard with a verified profile, list products with photos and variants (size/colour), manage inventory, and view a sales dashboard with revenue, orders, and payout history. " +
      "Buyers browse by category, search and filter, add to cart, check out, leave verified-purchase reviews with star ratings, and track shipments. " +
      "Requirements: secure payments with escrow released on delivery confirmation, a 2.5% platform commission, review moderation to block abuse, wishlist and follow-a-seller features, and an admin panel for dispute resolution. " +
      "Constraints: PCI-DSS compliant payment handling, GDPR-compliant data export/deletion, and sub-2-second product search across 100,000 listings.",
    meta: {
      organization: "Artisan Market Inc.",
      industry: "E-commerce / Retail",
      audience: "Independent makers and online shoppers",
      version: "1.0",
    },
    prefs: {
      theme: "modern-saas",
      color_mode: "light",
      layout_density: "balanced",
      navigation: "top",
      content_style: "cards",
      button_style: "rounded",
      card_style: "elevated",
      animations: "subtle",
    },
  },
  {
    emoji: "🩺",
    title: "Telemedicine",
    tagline: "Video consultations & e-prescriptions",
    name: "CareLink Health",
    description:
      "A telemedicine platform connecting patients with licensed doctors for remote video consultations. " +
      "Patients search doctors by specialty, book appointments against real-time availability, join an in-app video call, receive digital prescriptions, and access their visit history. " +
      "Doctors manage their calendar, conduct consultations, write e-prescriptions, and add clinical notes to a patient record. " +
      "Requirements: end-to-end encrypted video, an appointment reminder system (push/SMS/email), in-app payments per consultation, prescription PDFs sent to the patient and a partner pharmacy, and a triage questionnaire before each visit. " +
      "Constraints: HIPAA-compliant storage and audit logging, identity verification for doctors via license number, and graceful fallback to audio-only on poor connections.",
    meta: {
      organization: "CareLink Health",
      industry: "Healthcare",
      audience: "Patients and licensed physicians",
      version: "1.0",
    },
    prefs: {
      theme: "modern-saas",
      color_mode: "custom",
      primary_color: "#14b8a6",
      layout_density: "spacious",
      navigation: "sidebar",
      content_style: "mixed",
      button_style: "rounded",
      card_style: "elevated",
      animations: "subtle",
    },
  },
  {
    emoji: "💸",
    title: "Personal Finance",
    tagline: "Budgeting & expense tracking",
    name: "PennyWise",
    description:
      "A personal-finance app that helps individuals track spending, set budgets, and reach savings goals. " +
      "Users link bank accounts, see transactions auto-categorized (groceries, rent, transport…), set monthly budgets per category with overspend alerts, and create savings goals with progress tracking. " +
      "A dashboard visualizes cash flow, net worth, and spending trends over time; users can split shared expenses and export reports. " +
      "Requirements: secure bank aggregation via a third-party API, recurring-bill detection, customizable categories, and a weekly email summary. " +
      "Constraints: encryption of financial data at rest and in transit, biometric app lock, read-only bank access (no money movement), and support for multiple currencies.",
    meta: {
      organization: "PennyWise",
      industry: "Fintech / Personal Finance",
      audience: "Individuals managing personal budgets",
      version: "1.0",
    },
    prefs: {
      theme: "dashboard",
      color_mode: "dark",
      layout_density: "compact",
      navigation: "sidebar",
      content_style: "mixed",
      button_style: "rounded",
      card_style: "elevated",
      animations: "subtle",
    },
  },
];

const MAX_DESC = 5000;

export default function CreateProject() {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Optional client/document context — folded away by default to keep the form
  // simple; included in the create payload only for the fields the user fills.
  const [showDetails, setShowDetails] = useState(false);
  const [meta, setMeta] = useState<ProjectMetadata>({});
  const setMetaField = (key: keyof ProjectMetadata) => (value: string) =>
    setMeta((m) => ({ ...m, [key]: value }));

  // Optional UI design preferences — folded away; included in the payload only
  // for fields the user actually picks. Empty → AI chooses the design.
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<UIPreferences>({});
  const prefSummary = summarizePreferences(prefs);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Strip blanks so we only send fields the user actually provided.
      const metadata = Object.fromEntries(
        Object.entries(meta).filter(([, v]) => v && v.trim())
      ) as ProjectMetadata;
      const ui_preferences = cleanPreferences(prefs);
      const project = await createProject({
        name,
        description,
        ...(Object.keys(metadata).length ? { metadata } : {}),
        ...(Object.keys(ui_preferences).length ? { ui_preferences } : {}),
      });
      toast.success("Project created! Run the pipeline to generate artifacts.");
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(errorMessage(err, "Failed to create project."));
    } finally {
      setLoading(false);
    }
  }

  const META_FIELDS: { key: keyof ProjectMetadata; label: string; placeholder: string; type?: string; full?: boolean }[] = [
    { key: "organization", label: "Organization / company", placeholder: "Acme Corp" },
    { key: "industry", label: "Industry / domain", placeholder: "Healthcare, Fintech, Education…" },
    { key: "audience", label: "Target users / audience", placeholder: "Clinicians, patients, administrators…", full: true },
    { key: "author", label: "Prepared by", placeholder: "Defaults to your account name" },
    { key: "contact_email", label: "Contact email", placeholder: "Defaults to your account email", type: "email" },
    { key: "version", label: "Document version", placeholder: "1.0" },
  ];

  const panelHeader =
    "w-full flex items-center justify-between px-4 py-3 text-left bg-surface-2/50 hover:bg-surface-2 transition";

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
          <span className="mono-label text-[10px] text-ink">New Project</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 flex-1 w-full">
        <div className="mb-8">
          <Kicker className="mb-3">define</Kicker>
          <h1 className="text-3xl font-bold tracking-tight mb-2">New project</h1>
          <p className="text-muted leading-relaxed">
            Describe your software system. Be as detailed as possible — better input means better requirements.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 light:text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="proj-name">Project name</Label>
            <Input id="proj-name" type="text" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Software System" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Description</Label>
              <span className={`mono-label text-[10px] ${description.length > MAX_DESC * 0.9 ? "text-amber-400" : "text-faint"}`}>
                {description.length}/{MAX_DESC}
              </span>
            </div>
            <Textarea
              required
              minLength={10}
              maxLength={MAX_DESC}
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your system in detail — its purpose, users, main features, and any constraints…"
            />
          </div>

          {/* Optional organization & document details */}
          <div className="border border-line rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowDetails((s) => !s)} className={panelHeader}>
              <span className="text-sm font-medium text-ink">
                Organization &amp; document details
                <span className="text-faint font-normal"> · optional</span>
              </span>
              <ChevronDown size={16} className={`text-muted transition-transform ${showDetails ? "rotate-180" : ""}`} />
            </button>

            {showDetails && (
              <div className="p-4 grid sm:grid-cols-2 gap-4 border-t border-line">
                <p className="sm:col-span-2 text-xs text-muted leading-relaxed -mb-1">
                  Adds client and audience context to enrich the generated SRS, and appears on the exported title page. Leave any field blank to skip it.
                </p>
                {META_FIELDS.map((f) => (
                  <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                    <Label htmlFor={`meta-${f.key}`}>{f.label}</Label>
                    <Input
                      id={`meta-${f.key}`}
                      type={f.type ?? "text"}
                      value={meta[f.key] ?? ""}
                      onChange={(e) => setMetaField(f.key)(e.target.value)}
                      maxLength={400}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional UI design preferences */}
          <div className="border border-line rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowPrefs((s) => !s)} className={panelHeader}>
              <span className="text-sm font-medium text-ink">
                UI Design Preferences
                <span className="text-faint font-normal"> · optional</span>
              </span>
              <ChevronDown size={16} className={`text-muted transition-transform ${showPrefs ? "rotate-180" : ""}`} />
            </button>

            {showPrefs && (
              <div className="p-4 border-t border-line space-y-5">
                <p className="text-xs text-muted leading-relaxed">
                  Customize how the generated interface should look and feel. Leave empty for AI-generated design decisions.
                </p>
                <UIPreferencesForm value={prefs} onChange={setPrefs} />
              </div>
            )}
          </div>

          {/* Pre-generation summary of the chosen preferences */}
          {prefSummary.length > 0 && <UIPreferencesSummary lines={prefSummary} />}

          <div>
            <p className="mono-label text-[11px] text-muted mb-2">
              Try an example
              <span className="ml-2 normal-case tracking-normal text-faint">— fills in a detailed brief you can edit</span>
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex.title}
                  type="button"
                  onClick={() => {
                    setDescription(ex.description);
                    if (!name.trim()) setName(ex.name);
                    // Also seed the optional context so the example is a complete,
                    // editable brief — and reveal those panels so it's visible.
                    setMeta(ex.meta);
                    setPrefs(ex.prefs);
                    setShowDetails(true);
                    setShowPrefs(true);
                  }}
                  className="group text-left bg-surface border border-line hover:border-indigo-500/50 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{ex.emoji}</span>
                    <span className="text-sm font-medium text-ink/90 group-hover:text-ink transition">{ex.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted leading-relaxed">{ex.tagline}</p>
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={loading || name.length < 1 || description.length < 10} className="w-full">
            {loading ? "Creating…" : "Create project"}
          </Button>
        </form>
      </main>

      <footer className="border-t border-line py-6 text-center mono-label text-[10px] text-faint">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
